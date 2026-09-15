'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileCode2,
  FileUp,
  Loader2,
  Sheet as SheetIcon,
} from 'lucide-react';
import { buildXml, retencionesXmlFileName } from '@/lib/retenciones/buildXml';
import { downloadBlob } from '@/lib/retenciones/buildWorkbook';
import { readXlsx, type XlsxReadResult } from '@/lib/retenciones/readXlsx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const XML_MIME = 'application/xml;charset=utf-8';

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
      downloadBlob(blob, retencionesXmlFileName());
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
    <Card className="bg-muted/30 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-foreground/10">
          <SheetIcon className="size-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Convertir un Excel a XML
          </h2>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
            Subí un Excel ya generado por esta herramienta (podés haberlo
            editado a mano) y descargá el XML. No necesita PDFs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isReading}
        >
          {isReading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <FileUp />
          )}
          {isReading ? 'Leyendo…' : 'Elegir archivo .xlsx'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          hidden
          onChange={(e) => void onSelect(e)}
        />
        {fileName && (
          <span className="truncate text-sm text-muted-foreground">
            {fileName}
          </span>
        )}
      </div>

      {result?.fatal && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertTriangle className="size-4" />
          {result.fatal}
        </p>
      )}

      {result && !result.fatal && (
        <div className="flex animate-in flex-col items-start gap-3.5 fade-in-0 duration-300">
          <p className="flex flex-wrap items-center gap-2.5 text-sm">
            <span className="font-semibold text-foreground">
              {validCount} fila{validCount === 1 ? '' : 's'} válida
              {validCount === 1 ? '' : 's'}
            </span>
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3" />
                {errorCount} con error{errorCount === 1 ? '' : 'es'}
              </span>
            )}
          </p>

          {errorCount > 0 && (
            <ul className="flex w-full flex-col gap-1">
              {result.errors.map((err) => (
                <li
                  key={err.row}
                  className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm leading-relaxed text-destructive"
                >
                  <strong className="font-semibold">Fila {err.row}:</strong>{' '}
                  {err.message}
                </li>
              ))}
            </ul>
          )}

          {errorCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox
                checked={skipErrors}
                onCheckedChange={(checked) => setSkipErrors(checked === true)}
              />
              <span>
                Generar igual, omitiendo {errorCount} fila
                {errorCount === 1 ? '' : 's'} con error
              </span>
            </label>
          )}

          <Button type="button" disabled={!canGenerate} onClick={generate}>
            {isGenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FileCode2 />
            )}
            {isGenerating
              ? 'Generando…'
              : `Descargar XML${validCount ? ` (${validCount})` : ''}`}
          </Button>

          {genError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="size-4" />
              {genError}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
