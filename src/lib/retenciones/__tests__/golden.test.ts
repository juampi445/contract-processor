import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildXml } from '../buildXml';
import { parseRetencionPages } from '../parseDocument';
import type { RetencionRow } from '../types';

/**
 * End-to-end golden set: the 8 reference mill PDFs, parsed from the real file.
 *
 * Drop the PDFs into `__tests__/__fixtures__/` using the names below and these
 * tests activate; a missing fixture is skipped, so the suite stays green in a
 * checkout that does not carry the (client) documents. `aca.pdf` is the
 * non-regression guard — its expected values are the ones already in
 * production.
 */

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

/** The expected extraction for one certificate. */
interface Expected {
  contrato: string;
  liqCorrelDgi: string;
  fechaOrigen: string;
  /** IMPSINIVA as the decimal number the XLSX cell stores. */
  importe: number;
  cuitCorredor: string;
  conceptoRetIva: string;
}

const GOLDEN: ReadonlyArray<{ file: string; certificates: Expected[] }> = [
  {
    file: 'aca.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '200000490345',
        fechaOrigen: '01/06/2026',
        importe: 451263.08,
        cuitCorredor: '30500120882',
        conceptoRetIva: '3310-09051822',
      },
    ],
  },
  {
    file: 'amaggi.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '000300117798',
        fechaOrigen: '14/08/2026',
        importe: 12500000,
        cuitCorredor: '30711615519',
        conceptoRetIva: '3310-09345968',
      },
    ],
  },
  {
    file: 'arca.pdf',
    certificates: [
      {
        contrato: '',
        // "0000-2026-125081": the empty point-of-sale block is dropped.
        liqCorrelDgi: '2026125081',
        fechaOrigen: '31/07/2026',
        importe: 1077923.83,
        cuitCorredor: '30511534492',
        conceptoRetIva: '3310-09278898',
      },
    ],
  },
  {
    file: 'bunge.pdf',
    certificates: [
      {
        contrato: '1000562291',
        liqCorrelDgi: '002001500121',
        fechaOrigen: '11/09/2026',
        importe: 3117857.46,
        cuitCorredor: '30700869918',
        conceptoRetIva: '3310-09362466',
      },
    ],
  },
  {
    file: 'chs.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '86119',
        fechaOrigen: '28/08/2026',
        importe: 13075000,
        cuitCorredor: '30711160163',
        conceptoRetIva: '3310-09379539',
      },
    ],
  },
  {
    file: 'cofco.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '100100405442',
        fechaOrigen: '25/08/2026',
        importe: 2111293.44,
        cuitCorredor: '33506737449',
        conceptoRetIva: '3310-09374843',
      },
    ],
  },
  {
    file: 'idc.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '60117947023714',
        fechaOrigen: '09/09/2026',
        importe: 301478.88,
        cuitCorredor: '30526712729',
        conceptoRetIva: '3310-09430817',
      },
    ],
  },
  {
    file: 'molinocanuelas.pdf',
    certificates: [
      {
        contrato: '',
        liqCorrelDgi: '654274',
        fechaOrigen: '31/08/2026',
        importe: 14285600,
        cuitCorredor: '30507950848',
        conceptoRetIva: '3310-09383385',
      },
      {
        contrato: '',
        liqCorrelDgi: '654275',
        fechaOrigen: '31/08/2026',
        importe: 1041600,
        cuitCorredor: '30507950848',
        conceptoRetIva: '3310-09396127',
      },
    ],
  },
];

/**
 * Read a PDF's text layer page by page, mirroring `extractPdfPages`. The test
 * uses pdf.js' legacy build because the production one is browser-only (it
 * configures a bundler-emitted worker).
 */
async function pdfPages(path: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(path));
  const pdf = await pdfjs.getDocument({ data, useWorkerFetch: false }).promise;

  try {
    const pages: string[] = [];
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

/** The subset of a parsed row the golden table pins down. */
function actual(row: RetencionRow): Expected {
  return {
    contrato: row.contrato,
    liqCorrelDgi: row.liqCorrelDgi,
    fechaOrigen: row.fechaOrigen,
    importe: Number(row.impSinIva.replace(',', '.')),
    cuitCorredor: row.cuitCorredor,
    conceptoRetIva: row.conceptoRetIva,
  };
}

describe('golden set — the 8 reference formats', () => {
  for (const { file, certificates } of GOLDEN) {
    const path = join(FIXTURES, file);
    const run = existsSync(path) ? it : it.skip;

    run(`extracts ${file}`, async () => {
      const parsed = parseRetencionPages(await pdfPages(path));

      const failures = parsed
        .filter((c) => !c.result.ok)
        .flatMap((c) => (c.result.ok ? [] : c.result.errors))
        .map((e) => `${e.field}: ${e.message}`);
      expect(failures, `campos no extraídos en ${file}`).toEqual([]);

      const rows = parsed.map((c) => {
        if (!c.result.ok) throw new Error('unreachable');
        return actual(c.result.row);
      });
      expect(rows).toEqual(certificates);

      // Nothing may export flagged: an unknown issuer or an amount that is not
      // 5% of the base means a pattern drifted, even if the values still match.
      const warnings = parsed.flatMap((c) =>
        c.result.ok ? c.result.warnings : [],
      );
      expect(warnings, `advertencias en ${file}`).toEqual([]);
    });
  }
});

describe('golden set — the XML keeps the identifiers intact', () => {
  const path = join(FIXTURES, 'amaggi.pdf');
  const run = existsSync(path) ? it : it.skip;

  run('writes LIQCORRELDGI with its leading zeros', async () => {
    const [certificate] = parseRetencionPages(await pdfPages(path));
    if (!certificate.result.ok) throw new Error('expected ok');
    const row = certificate.result.row;

    const xml = buildXml([
      {
        contrato: row.contrato,
        ordenInter: row.ordenInter,
        liqCorrelDgi: row.liqCorrelDgi,
        fecha: row.fechaOrigen,
        importe: row.impSinIva,
        cuitCorredor: row.cuitCorredor,
        concepto: row.conceptoRetIva,
      },
    ]);

    expect(xml).toContain('<LIQCORRELDGI>000300117798</LIQCORRELDGI>');
    expect(xml).toContain('<IMPSINIVA>1250000000</IMPSINIVA>');
    expect(xml).toContain('<IMPTOTAL>1250000000</IMPTOTAL>');
    expect(xml).toContain('<CUITCORREDOR>30711615519</CUITCORREDOR>');
  });
});

describe('golden set — derived columns are never extracted', () => {
  const path = join(FIXTURES, 'aca.pdf');
  const run = existsSync(path) ? it : it.skip;

  run('FECHAVTO mirrors FECHAORIGEN and IMPTOTAL mirrors IMPSINIVA', async () => {
    const [certificate] = parseRetencionPages(await pdfPages(path));
    if (!certificate.result.ok) throw new Error('expected ok');
    const row = certificate.result.row;
    expect(row.fechaVto).toBe(row.fechaOrigen);
    expect(row.impTotal).toBe(row.impSinIva);
    expect(row.nroRegOlcu).toBe(1);
    expect(row.observacion).toBeNull();
  });
});
