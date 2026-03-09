/**
 * PlayStake Widget Build Script
 *
 * Builds the widget as a standalone React app, separate from the Next.js app.
 * Bundles React + ReactDOM into the output so the widget is fully self-contained.
 *
 * Usage:
 *   npx tsx widget.build.ts
 *   npm run widget:build
 *
 * Output:
 *   public/widget/widget.js   — bundled + minified JS
 *   public/widget/widget.css  — bundled CSS
 *   public/widget/index.html  — copied from src/widget/index.html
 */

import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const IS_PROD = process.env.NODE_ENV === "production";

async function build() {
  const outdir = path.resolve(__dirname, "public/widget");

  // Ensure output directory exists
  fs.mkdirSync(outdir, { recursive: true });

  // Build the widget JS + CSS bundle
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, "src/widget/widget.tsx")],
    bundle: true,
    outdir,
    entryNames: "widget",
    format: "esm",
    platform: "browser",
    target: ["es2020", "chrome90", "firefox90", "safari15"],
    minify: IS_PROD,
    sourcemap: IS_PROD ? false : "inline",
    metafile: true,
    loader: {
      ".tsx": "tsx",
      ".ts": "ts",
      ".css": "css",
    },
    // Bundle React into the widget so it's fully self-contained
    external: [],
    // CSS entry — import the widget CSS from the tsx file or as a separate entry
    // We handle CSS by adding the CSS file as an entry point
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        IS_PROD ? "production" : "development"
      ),
    },
    jsx: "automatic",
    // Tree-shake unused exports
    treeShaking: true,
  });

  // Also build the CSS separately to guarantee it's output
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, "src/widget/styles/widget.css")],
    bundle: true,
    outfile: path.join(outdir, "widget.css"),
    minify: IS_PROD,
    loader: { ".css": "css" },
  });

  // Copy index.html to output
  const htmlSrc = path.resolve(__dirname, "src/widget/index.html");
  const htmlDest = path.join(outdir, "index.html");
  fs.copyFileSync(htmlSrc, htmlDest);

  // Print bundle size info
  if (result.metafile) {
    const outputs = result.metafile.outputs;
    console.log("\nWidget build complete:\n");
    for (const [file, info] of Object.entries(outputs)) {
      const sizeKB = (info.bytes / 1024).toFixed(1);
      console.log(`  ${path.basename(file)}: ${sizeKB} KB`);
    }
    console.log("");
  }
}

build().catch((err) => {
  console.error("Widget build failed:", err);
  process.exit(1);
});
