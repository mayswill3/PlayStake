// Regenerates docs/compliance/pdf/ from the Markdown, rendering Mermaid diagrams.
// Uses the Chrome installed on this machine; its dependencies are kept out of
// the app's package.json. To run:
//   mkdir -p /tmp/ps-pdf && cp docs/compliance/make-pdfs.mjs /tmp/ps-pdf/
//   (cd /tmp/ps-pdf && npm i playwright-core marked mermaid@11)
//   node /tmp/ps-pdf/make-pdfs.mjs "$PWD/docs/compliance"
import { chromium } from 'playwright-core';
import { marked } from 'marked';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const dir = process.argv[2];
const outDir = join(dir, 'pdf');
mkdirSync(outDir, { recursive: true });
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();

const css = `
  @page { size: A4; margin: 22mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 10.2pt; line-height: 1.5; color: #1a1d23; }
  h1 { font-size: 20pt; margin: 0 0 12pt; color: #0b0f14; border-bottom: 3px solid #5ad6a8; padding-bottom: 6pt; }
  h2 { font-size: 13.5pt; margin: 18pt 0 6pt; color: #0b0f14; page-break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #0b0f14; page-break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { padding-left: 18pt; }
  li { margin: 2pt 0; }
  a { color: #0f7a57; text-decoration: none; }
  code { font-family: Menlo, Consolas, monospace; font-size: 8.8pt; background: #f1f3f5; padding: 0 3px; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 8.9pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #d6dbe0; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #eef6f2; font-weight: 600; }
  .doc > table:first-of-type thead { display: none; }
  .doc > table:first-of-type td:first-child { width: 28%; font-weight: 600; background: #fafbfc; }
  blockquote { margin: 10pt 0; padding: 8pt 12pt; background: #fff8e6; border-left: 4px solid #e5a50a; color: #3d3320; }
  blockquote p { margin: 4pt 0; }
  hr { border: none; border-top: 1px solid #d6dbe0; margin: 14pt 0; }
  .doc + .doc { page-break-before: always; }
  .diagram { margin: 10pt 0 14pt; text-align: center; page-break-inside: avoid; }
  .diagram svg { max-width: 100% !important; height: auto; max-height: 235mm; }
  pre.mermaid { background: none; }
`;

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
marked.use({
  renderer: {
    code(token) {
      if (token.lang === 'mermaid') return `<div class="diagram"><pre class="mermaid">${escapeHtml(token.text)}</pre></div>`;
      return false;
    },
  },
});
const toHtml = (md) =>
  marked.parse(md.replace(/\]\((\d\d-[^)]+)\.md\)/g, '](./$1.pdf)'));

const titleOf = (md) => (md.match(/^# (.+)$/m)?.[1] ?? '').replace(/"/g, '');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

async function render(bodyHtml, title, outPath) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`, { waitUntil: 'load' });
  if (bodyHtml.includes('class="mermaid"')) {
    await page.addScriptTag({ path: new URL('./node_modules/mermaid/dist/mermaid.min.js', import.meta.url).pathname });
    await page.evaluate(async () => {
      window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', flowchart: { htmlLabels: true, useMaxWidth: true }, securityLevel: 'loose' });
      await window.mermaid.run({ querySelector: '.mermaid' });
    });
    const errors = await page.$$eval('.mermaid', (els) => els.filter((e) => !e.querySelector('svg')).length);
    if (errors) throw new Error(`${errors} diagram(s) failed to render in ${title}`);
  }
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#6b7280;padding:0 18mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;"><span>PlayStake · ${title} · DRAFT v0.1</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: { top: '20mm', bottom: '18mm', left: '0', right: '0' },
  });
}

const all = [];
for (const file of files) {
  const md = readFileSync(join(dir, file), 'utf8');
  const title = titleOf(md);
  const html = `<div class="doc">${toHtml(md)}</div>`;
  all.push(html);
  await render(html, title, join(outDir, basename(file, '.md') + '.pdf'));
  console.log('wrote', basename(file, '.md') + '.pdf');
}
await render(all.join('\n'), 'Compliance Manual and Policies (complete)', join(outDir, 'PlayStake-Compliance-Manual-complete.pdf'));
console.log('wrote combined');
await browser.close();
