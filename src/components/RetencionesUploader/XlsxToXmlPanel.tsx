'use client';

import { useCallback, useRef, useState } from 'react';
import { buildXml } from '@/lib/retenciones/buildXml';
import {
  downloadBlob,
  retencionesFileName,
} from '@/lib/retenciones/buildWorkbook';
import { readXlsx, type XlsxReadResult } from '@/lib/retenciones/readXlsx';
import {
  IconAlert,
  IconCode,
  IconFile,
  IconSheet,
  IconSpinner,
} from './Icons';
import styles from './XlsxToXmlPanel.module.scss';

const XML_MIME = 'text/xml;charset=utf-8';

/**
 * Standalone flow: take one filled XLSX (produced earlier by this tool,
 * possibly hand-edited) and download the corresponding XML. Works with zero
 * PDFs loaded and never shares data with the in-memory flow.
 */
export default function XlsxToXmlPanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<XlsxReadResult | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setFileName(file.name);
      setResult(null);
      setGenError(null);
      setSkipErrors(false);
      setIsReading(true);
      try {
        setResult(await readXlsx(file));
      } catch (err) {
        setResult({
          rows: [],
          errors: [],
          fatal: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsReading(false);
      }
    },
    [],
  );

  const generate = useCallback(() => {
    if (!result) return;
    setGenError(null);
    setIsGenerating(true);
    try {
      const xml = buildXml(result.rows);
      const blob = new Blob([xml], { type: XML_MIME });
      downloadBlob(blob, retencionesFileName('xml'));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [result]);

  const errorCount = result?.errors.length ?? 0;
  const validCount = result?.rows.length ?? 0;
  const canGenerate =
    !!result &&
    !result.fatal &&
    validCount > 0 &&
    (errorCount === 0 || skipErrors) &&
    !isGenerating &&
    !isReading;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.headIcon}>
          <IconSheet size={18} />
        </span>
        <div>
          <h2>Convertir un Excel a XML</h2>
          <p>
            Subí un Excel ya generado por esta herramienta (podés haberlo
            editado a mano) y descargá el XML. No necesita PDFs.
          </p>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.selectBtn}
          onClick={() => inputRef.current?.click()}
          disabled={isReading}
        >
          {isReading ? <IconSpinner size={17} /> : <IconFile size={17} />}
          {isReading ? 'Leyendo…' : 'Elegir archivo .xlsx'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          hidden
          onChange={(e) => void onSelect(e)}
        />
        {fileName && <span className={styles.fileName}>{fileName}</span>}
      </div>

      {result?.fatal && (
        <p className={styles.fatal} role="alert">
          <IconAlert size={16} />
          {result.fatal}
        </p>
      )}

      {result && !result.fatal && (
        <div className={styles.summary}>
          <p className={styles.counts}>
            <span className={styles.okCount}>
              {validCount} fila{validCount === 1 ? '' : 's'} válida
              {validCount === 1 ? '' : 's'}
            </span>
            {errorCount > 0 && (
              <span className={styles.errPill}>
                <IconAlert size={13} />
                {errorCount} con error{errorCount === 1 ? '' : 'es'}
              </span>
            )}
          </p>

          {errorCount > 0 && (
            <ul className={styles.errorList}>
              {result.errors.map((err) => (
                <li key={err.row}>
                  <strong>Fila {err.row}:</strong> {err.message}
                </li>
              ))}
            </ul>
          )}

          {errorCount > 0 && (
            <label className={styles.skipToggle}>
              <input
                type="checkbox"
                checked={skipErrors}
                onChange={(e) => setSkipErrors(e.target.checked)}
              />
              <span>
                Generar igual, omitiendo {errorCount} fila
                {errorCount === 1 ? '' : 's'} con error
              </span>
            </label>
          )}

          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canGenerate}
            onClick={generate}
          >
            {isGenerating ? <IconSpinner size={18} /> : <IconCode size={18} />}
            {isGenerating
              ? 'Generando…'
              : `Descargar XML${validCount ? ` (${validCount})` : ''}`}
          </button>

          {genError && (
            <p className={styles.fatal} role="alert">
              <IconAlert size={16} />
              {genError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
