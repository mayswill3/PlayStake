// =============================================================================
// PlayStake — Recording storage (Cloudflare R2, S3-compatible)
// =============================================================================

import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PLAYBACK_URL_TTL_SECONDS, r2Config } from "./config";

let client: S3Client | null = null;

function s3(): { client: S3Client; bucket: string } {
  const config = r2Config();
  if (!config) throw new Error("R2 storage is not configured");
  client ??= new S3Client({
    region: "auto",
    endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { client, bucket: config.bucket };
}

export async function uploadFile(key: string, path: string, contentType = "video/mp4"): Promise<number> {
  const { client, bucket } = s3();
  const { size } = await stat(path);
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType }),
  );
  return size;
}

/** A short-lived private link to watch a recording. */
export function playbackUrl(key: string, filename: string): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: "video/mp4",
      ResponseContentDisposition: `inline; filename="${filename}"`,
    }),
    { expiresIn: PLAYBACK_URL_TTL_SECONDS },
  );
}

/** Delete everything stored under a prefix (a match's final file and segments). */
export async function deletePrefix(prefix: string): Promise<number> {
  const { client, bucket } = s3();
  let deleted = 0;
  let token: string | undefined;
  do {
    const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    const keys = (list.Contents ?? []).map((item) => ({ Key: item.Key! })).filter((item) => item.Key);
    if (keys.length) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
      deleted += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
