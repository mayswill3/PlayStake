/**
 * PlayStake Worker Build Script
 *
 * Compiles the BullMQ worker process (src/workers/index.ts) ahead of time so
 * production runs plain `node` instead of transpiling TypeScript on boot with
 * tsx — lower memory and a faster start.
 *
 * Our own source (including the generated Prisma client and "@/..." imports)
 * is bundled; npm packages stay external and load from node_modules at runtime.
 *
 * Usage:
 *   npm run workers:build     → dist/workers/index.mjs
 *   npm run workers:start     → node dist/workers/index.mjs
 */

import * as esbuild from "esbuild";
import * as path from "path";

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "src/workers/index.ts")],
    outfile: path.resolve(__dirname, "dist/workers/index.mjs"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    packages: "external",
    tsconfig: path.resolve(__dirname, "tsconfig.json"),
    sourcemap: true,
    metafile: true,
    logLevel: "warning",
    plugins: [
      {
        // src/lib/errors pulls in `next/server`. Next has no "exports" map, so
        // Node's strict ESM resolver needs the explicit file extension.
        name: "next-server-esm",
        setup(build) {
          build.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
        },
      },
    ],
  });

  const bytes = Object.values(result.metafile.outputs).reduce((sum, out) => sum + out.bytes, 0);
  console.log(`Workers built → dist/workers/index.mjs (${(bytes / 1024).toFixed(0)} KB incl. sourcemap)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
