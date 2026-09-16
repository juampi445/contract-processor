import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// pdfjs-dist references browser globals (DOMMatrix, etc.) at module-evaluation
// time, which breaks Next's server prerender. We therefore import it lazily —
// only inside the browser-only code path — and configure the worker once.
type PdfjsModule = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      // `new URL(..., import.meta.url)` is understood by Next's bundler, which
      // emits the bundled worker as an asset and rewrites this to its URL.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Narrow a text-content item to one that actually carries a `str`. */
function isTextItem(item: TextItem | { type: string }): item is TextItem {
  return 'str' in item;
}

/**
 * Extract the normalized text layer of a PDF, ONE STRING PER PAGE.
 *
 * Within a page every item is joined with spaces and whitespace collapsed,
 * because the raw item order and newlines from pdf.js are not reliable. Pages
 * are kept apart because some mills (molinocañuelas) print one certificate per
 * page — see `parseRetencionPages`.
 */
export async function extractPdfPages(file: File): Promise<string[]> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  try {
    const pageTexts: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (isTextItem(item) ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText.replace(/\s+/g, ' ').trim());
    }
    return pageTexts;
  } finally {
    await pdf.destroy();
  }
}

/** All pages joined into the single normalized line the parsers consume. */
export async function extractPdfText(file: File): Promise<string> {
  const pages = await extractPdfPages(file);
  return pages.join(' ').replace(/\s+/g, ' ').trim();
}
