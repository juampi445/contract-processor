'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildWorkbook,
  downloadBlob,
  retencionesFileName,
} from '@/lib/retenciones/buildWorkbook';
import { buildXml } from '@/lib/retenciones/buildXml';
import { extractPdfText } from '@/lib/retenciones/extractPdfText';
import { parseRetencion } from '@/lib/retenciones/parseRetencion';
import type { FileResult, RetencionRow } from '@/lib/retenciones/types';
import {
  IconAlert,
  IconCheck,
  IconCode,
  IconSheet,
  IconShield,
  IconSpinner,
  IconUpload,
  IconX,
} from './Icons';
import styles from './RetencionesUploader.module.scss';
import XlsxToXmlPanel from './XlsxToXmlPanel';

const XML_MIME = 'text/xml;charset=utf-8';
const PARSE_CONCURRENCY = 3;

/** Focused preview: the fields that come from the PDF, in a friendly order. */
const PREVIEW_COLS: ReadonlyArray<{
  header: string;
  get: (r: RetencionRow) => string;
  numeric?: boolean;
}> = [
  { header: 'Liq. DGI', get: (r) => r.liqCorrelDgi },
  { header: 'Fecha', get: (r) => r.fechaOrigen },
  { header: 'Importe', get: (r) => r.impSinIva, numeric: true },
  { header: 'CUIT corredor', get: (r) => r.cuitCorredor },
  { header: 'Concepto', get: (r) => r.conceptoRetIva },
];

/** A file plus its (possibly pending) parse outcome, kept in selection order. */
interface Entry {
  id: string;
  file: File;
  parsing: boolean;
  result?: FileResult;
}

/** Run `fn` over `items` with a fixed concurrency limit. */
async function runWithLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await fn(items[index]);
      }
    })(),
  );
  await Promise.all(workers);
}

/** Parse a single file into a `FileResult`. Never throws. */
async function parseFile(id: string, file: File): Promise<FileResult> {
  try {
    const text = await extractPdfText(file);
    if (text.trim().length < 50) {
      return {
        id,
        fileName: file.name,
        status: 'error',
        errors: [
          {
            field: 'text',
            message: 'PDF sin capa de texto (no soportado, requiere OCR)',
          },
        ],
      };
    }
    const parsed = parseRetencion(text);
    return parsed.ok
      ? { id, fileName: file.name, status: 'ok', row: parsed.row }
      : { id, fileName: file.name, status: 'error', errors: parsed.errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id,
      fileName: file.name,
      status: 'error',
      errors: [{ field: 'text', message: `No se pudo leer el PDF: ${message}` }],
    };
  }
}

export default function RetencionesUploader() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [skipFailed, setSkipFailed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patchEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const pdfs = Array.from(fileList).filter(
        (f) =>
          f.type === 'application/pdf' ||
          f.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfs.length === 0) return;

      const newEntries: Entry[] = pdfs.map((file) => ({
        id: crypto.randomUUID(),
        file,
        parsing: true,
      }));
      setEntries((prev) => [...prev, ...newEntries]);

      await runWithLimit(newEntries, PARSE_CONCURRENCY, async (entry) => {
        const result = await parseFile(entry.id, entry.file);
        patchEntry(entry.id, { parsing: false, result });
      });
    },
    [patchEntry],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const onSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) void addFiles(e.target.files);
      e.target.value = '';
    },
    [addFiles],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    setGenError(null);
  }, []);

  const okRows = useMemo(
    () =>
      entries
        .filter((e) => e.result?.status === 'ok' && e.result.row)
        .map((e) => e.result!.row!),
    [entries],
  );

  const isParsing = entries.some((e) => e.parsing);
  const errorCount = entries.filter(
    (e) => e.result?.status === 'error',
  ).length;
  const canGenerate =
    !isParsing &&
    okRows.length > 0 &&
    (errorCount === 0 || skipFailed) &&
    !isGenerating;

  const generate = useCallback(async () => {
    setGenError(null);
    setIsGenerating(true);
    try {
      const blob = await buildWorkbook(okRows);
      downloadBlob(blob, retencionesFileName());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [okRows]);

  const generateXml = useCallback(() => {
    setGenError(null);
    try {
      const xml = buildXml(
        okRows.map((r) => ({
          // A/B are filled in by hand in Excel, so they're empty in this
          // straight-from-PDF shortcut — same empty tags as before.
          contrato: r.contrato ?? '',
          ordenInter: r.ordenInter ?? '',
          liqCorrelDgi: r.liqCorrelDgi,
          fecha: r.fechaOrigen,
          importe: r.impSinIva,
          cuitCorredor: r.cuitCorredor,
          concepto: r.conceptoRetIva,
        })),
      );
      const blob = new Blob([xml], { type: XML_MIME });
      downloadBlob(blob, retencionesFileName('xml'));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
  }, [okRows]);

  const okCount = okRows.length;

  return (
    <div className={styles.page}>
      <header className={styles.appbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            BP
          </span>
          <div>
            <h1 className={styles.title}>
              Braulio <em>“the old men”</em> Ponce
            </h1>
            <p className={styles.subtitle}>
              Procesador de constancias de retención
            </p>
          </div>
        </div>
        <span className={styles.localTag}>
          <IconShield size={15} />
          100% local
        </span>
      </header>

      <main className={styles.shell}>
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2>Constancias en PDF</h2>
            <p>Arrastrá las constancias y descargá el Excel o el XML.</p>
          </div>

          <div
            className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={onSelect}
            />
            <span className={styles.dropIcon}>
              <IconUpload size={26} />
            </span>
            <p className={styles.dropTitle}>Arrastrá los PDF acá</p>
            <p className={styles.dropHint}>
              o <span className={styles.dropLink}>elegilos de tu computadora</span>
              {' · '}podés cargar varios a la vez
            </p>
          </div>

          {entries.length > 0 && (
            <div className={styles.fileList}>
              <div className={styles.fileListHead}>
                <span>
                  {entries.length} archivo{entries.length === 1 ? '' : 's'}
                  {isParsing && (
                    <span className={styles.processing}> · leyendo…</span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={clearAll}
                >
                  Quitar todos
                </button>
              </div>

              <ul>
                {entries.map((entry, i) => {
                  const status = entry.parsing
                    ? 'parsing'
                    : (entry.result?.status ?? 'error');
                  return (
                    <li
                      key={entry.id}
                      className={styles.fileItem}
                      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    >
                      <span
                        className={`${styles.badge} ${styles[`badge_${status}`]}`}
                        role="img"
                        aria-label={
                          status === 'parsing'
                            ? 'Leyendo'
                            : status === 'ok'
                              ? 'Correcto'
                              : 'Con error'
                        }
                      >
                        {status === 'parsing' ? (
                          <IconSpinner size={16} />
                        ) : status === 'ok' ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconAlert size={15} />
                        )}
                      </span>

                      <div className={styles.fileMeta}>
                        <span className={styles.fileName}>{entry.file.name}</span>
                        {status === 'ok' && (
                          <span className={styles.okNote}>Listo para exportar</span>
                        )}
                        {entry.result?.status === 'error' &&
                          entry.result.errors && (
                            <ul className={styles.errorList}>
                              {entry.result.errors.map((err, j) => (
                                <li key={j}>
                                  {err.field !== 'text' ? `${err.field}: ` : ''}
                                  {err.message}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>

                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeEntry(entry.id)}
                        aria-label={`Quitar ${entry.file.name}`}
                      >
                        <IconX size={17} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {okCount > 0 && (
            <div className={styles.previewWrap}>
              <div className={styles.previewHead}>
                <h3>Vista previa</h3>
                <span className={styles.count}>
                  {okCount} fila{okCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.preview}>
                  <thead>
                    <tr>
                      <th className={styles.rowNum} scope="col">
                        #
                      </th>
                      {PREVIEW_COLS.map((c) => (
                        <th
                          key={c.header}
                          scope="col"
                          className={c.numeric ? styles.numeric : undefined}
                        >
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {okRows.map((row, i) => (
                      <tr key={i}>
                        <td className={styles.rowNum}>{i + 1}</td>
                        {PREVIEW_COLS.map((c) => (
                          <td
                            key={c.header}
                            className={c.numeric ? styles.numeric : undefined}
                          >
                            {c.get(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className={styles.actions}>
              {errorCount > 0 && (
                <label className={styles.skipToggle}>
                  <input
                    type="checkbox"
                    checked={skipFailed}
                    onChange={(e) => setSkipFailed(e.target.checked)}
                  />
                  <span>
                    Generar igual, omitiendo {errorCount} archivo
                    {errorCount === 1 ? '' : 's'} con error
                    {errorCount === 1 ? '' : 'es'}
                  </span>
                </label>
              )}

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                >
                  {isGenerating ? (
                    <IconSpinner size={18} />
                  ) : (
                    <IconSheet size={18} />
                  )}
                  {isGenerating
                    ? 'Generando…'
                    : `Descargar Excel${okCount ? ` (${okCount})` : ''}`}
                </button>

                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={okCount === 0 || isParsing || isGenerating}
                  onClick={generateXml}
                >
                  <IconCode size={18} />
                  Descargar XML{okCount ? ` (${okCount})` : ''}
                </button>
              </div>

              {genError && (
                <p className={styles.genError} role="alert">
                  <IconAlert size={16} />
                  {genError}
                </p>
              )}
            </div>
          )}
        </section>

        <div className={styles.altDivider}>
          <span>¿ya tenés un Excel?</span>
        </div>

        <XlsxToXmlPanel />
      </main>

      <footer className={styles.pageFoot}>
        Constancias de retención · IVA Rég. Granos RG AFIP 2300
      </footer>
    </div>
  );
}
