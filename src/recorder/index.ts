// =============================================================================
// PlayStake — Match recorder
// =============================================================================
// Its own service (Dockerfile.recorder). For each match a referee starts, it:
//
//   1. starts a virtual 1920×1080 screen (Xvfb) and its own audio sink,
//   2. opens the recording view in Chrome — both players' and the referee's
//      Kick streams with the match clock and events — with sound,
//   3. records screen and sound with ffmpeg in 5-minute segments, uploading
//      each to storage as soon as it's finished, so a crash loses little,
//   4. stops when the referee records the result (or the match ends),
//   5. joins the segments, takes the file's SHA-256, uploads it and seals the
//      recording, writing the fingerprint into the match's audit trail.
//
// Needs: DATABASE_URL, REDIS_URL, R2_*, RECORDER_SECRET, RECORDER_APP_URL
// (or NEXT_PUBLIC_APP_URL). RECORDER_CONCURRENCY sets matches per instance.
// =============================================================================

import { spawn, type ChildProcess } from "child_process";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../lib/jobs/queue";
import { QUEUE_NAMES } from "../lib/jobs/types";
import { RECORDING_SEGMENT_SECONDS, recordingKey } from "../lib/recordings/config";
import { beginRecording, failRecording, sealRecording, shouldStopRecording, type RecordMatchPayload } from "../lib/recordings/service";
import { deletePrefix, uploadFile } from "../lib/recordings/storage";
import { signRecorderToken } from "../lib/recordings/token";

const CONCURRENCY = Math.max(1, Number(process.env.RECORDER_CONCURRENCY ?? 2));
const APP_URL = (process.env.RECORDER_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://playstake.org").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "chromium";
/** Keep recording briefly after the result, so the moment is fully on file. */
const STOP_GRACE_MS = 20_000;
const POLL_MS = 10_000;

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, service: "recorder", ...data }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function run(cmd: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["pipe", "ignore", "pipe"] });
  child.stderr?.on("data", () => undefined); // drain so the pipe never blocks
  return child;
}

function exited(child: ChildProcess, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function runToEnd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))));
  });
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
  });
}

// Each concurrent recording gets its own display and audio sink.
const freeSlots = Array.from({ length: CONCURRENCY }, (_, index) => index);

async function recordMatch(betId: string): Promise<void> {
  const slot = freeSlots.shift();
  if (slot === undefined) throw new Error("No free recorder slot");
  const display = `:${99 + slot}`;
  const sink = `match${slot}`;
  const dir = join(tmpdir(), `playstake-recording-${betId}`);
  const segmentsDir = join(dir, "segments");
  const processes: ChildProcess[] = [];
  let sinkModule: string | null = null;

  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(segmentsDir, { recursive: true });

    processes.push(run("Xvfb", [display, "-screen", "0", "1920x1080x24", "-nolisten", "tcp"]));
    sinkModule = (await runToEnd("pactl", ["load-module", "module-null-sink", `sink_name=${sink}`])).trim();
    await sleep(1000);

    const url = `${APP_URL}/recorder/${betId}?token=${encodeURIComponent(signRecorderToken(betId, 3 * 60 * 60 * 1000))}`;
    processes.push(
      run(
        CHROME,
        [
          "--no-sandbox",
          "--kiosk",
          "--window-position=0,0",
          "--window-size=1920,1080",
          "--autoplay-policy=no-user-gesture-required",
          "--no-first-run",
          "--disable-infobars",
          "--disable-features=Translate,MediaRouter",
          "--disable-session-crashed-bubble",
          `--user-data-dir=${join(dir, "chrome")}`,
          url,
        ],
        { DISPLAY: display, PULSE_SINK: sink },
      ),
    );
    // Let the page and the three Kick players load before recording starts.
    await sleep(12_000);

    const recording = await beginRecording(betId);
    const ffmpeg = run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "x11grab", "-video_size", "1920x1080", "-framerate", "30", "-draw_mouse", "0", "-i", display,
      "-f", "pulse", "-i", `${sink}.monitor`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-g", "60",
      "-c:a", "aac", "-b:a", "128k",
      "-f", "segment", "-segment_time", String(RECORDING_SEGMENT_SECONDS), "-reset_timestamps", "1", "-segment_format", "mp4",
      join(segmentsDir, "seg%03d.mp4"),
    ]);
    processes.push(ffmpeg);
    log("info", "recording_started", { betId, display });

    // Upload finished segments as we go; stop when the match is over.
    const uploaded = new Set<string>();
    const uploadFinished = async (includeLast: boolean) => {
      const files = (await readdir(segmentsDir)).filter((name) => name.endsWith(".mp4")).sort();
      const finished = includeLast ? files : files.slice(0, -1);
      for (const name of finished) {
        if (uploaded.has(name)) continue;
        await uploadFile(recordingKey(betId, `segments/${name}`), join(segmentsDir, name));
        uploaded.add(name);
      }
      return files;
    };

    let stopAt: number | null = null;
    while (true) {
      await sleep(POLL_MS);
      if (ffmpeg.exitCode !== null) throw new Error(`ffmpeg stopped unexpectedly (exit ${ffmpeg.exitCode})`);
      await uploadFinished(false).catch((error) => log("warn", "segment_upload_retry", { betId, error: String(error) }));
      if (stopAt === null && (await shouldStopRecording(betId, recording.startedAt))) stopAt = Date.now() + STOP_GRACE_MS;
      if (stopAt !== null && Date.now() >= stopAt) break;
    }

    ffmpeg.stdin?.write("q");
    await exited(ffmpeg, 30_000);
    const segments = await uploadFinished(true);
    if (segments.length === 0) throw new Error("No video was captured");

    // One file for reviewers: join the segments without re-encoding.
    const list = join(dir, "segments.txt");
    await writeFile(list, segments.map((name) => `file '${join(segmentsDir, name)}'`).join("\n"));
    const final = join(dir, "recording.mp4");
    await runToEnd("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", final]);
    const duration = Number((await runToEnd("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", final])).trim());
    const sha256 = await sha256File(final);
    const key = recordingKey(betId, "recording.mp4");
    const byteSize = await uploadFile(key, final);
    await deletePrefix(recordingKey(betId, "segments/"));
    await sealRecording({ betId, key, byteSize, durationSeconds: Math.round(duration), sha256 });
    log("info", "recording_sealed", { betId, byteSize, durationSeconds: Math.round(duration), sha256 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "recording_failed", { betId, error: message });
    // Any uploaded segments stay in storage as partial evidence.
    await failRecording(betId, message).catch(() => undefined);
    throw error;
  } finally {
    for (const child of processes.reverse()) {
      child.kill("SIGTERM");
      await exited(child, 5_000);
    }
    if (sinkModule) await runToEnd("pactl", ["unload-module", sinkModule]).catch(() => undefined);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    freeSlots.push(slot);
  }
}

async function main() {
  // One PulseAudio server for the container; each match adds its own sink.
  await runToEnd("pulseaudio", ["-D", "--exit-idle-time=-1", "--system=false"]).catch((error) =>
    log("warn", "pulseaudio_start", { error: String(error) }),
  );

  const worker = new Worker<RecordMatchPayload>(
    QUEUE_NAMES.MATCH_RECORDING,
    async (job: Job<RecordMatchPayload>) => recordMatch(job.data.betId),
    {
      connection: getRedisConnection() as unknown as import("bullmq").ConnectionOptions,
      concurrency: CONCURRENCY,
      // A recording can run for two hours; keep the job's lock alive meanwhile.
      lockDuration: 5 * 60_000,
    },
  );
  worker.on("error", (err) => log("error", "recorder_worker_error", { error: err.message }));
  log("info", "recorder_started", { concurrency: CONCURRENCY, appUrl: APP_URL });

  const shutdown = async () => {
    log("info", "recorder_stopping");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main();
