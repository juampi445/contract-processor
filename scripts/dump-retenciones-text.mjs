/**
 * Dump the text layer of every retención fixture, page by page, exactly as
 * `extractPdfPages` produces it in the app.
 *
 * The extraction patterns MUST be derived from this output: pdf.js orders and
 * spaces the text differently from other extractors, so a pattern that reads
 * fine in a PDF viewer can be unmatchable here.
 *
 *   node scripts/dump-retenciones-text.mjs [name ...]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'lib',
  'retenciones',
  '__tests__',
  '__fixtures__',
);

const NAMES = [
  'aca',
  'amaggi',
  'arca',
  'bunge',
  'chs',
  'cofco',
  'idc',
  'molinocanuelas',
];

/** Same joining and whitespace collapsing as `extractPdfPages`. */
async function pdfPages(path) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(path));
  const pdf = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise;
  try {
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(text.replace(/\s+/g, ' ').trim());
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : NAMES;

for (const name of names) {
  console.log(`\n===== ${name} =====`);
  const pages = await pdfPages(join(FIXTURES, `${name}.pdf`));
  pages.forEach((text, i) => console.log(`--- pág ${i + 1} ---\n${text}`));
}
