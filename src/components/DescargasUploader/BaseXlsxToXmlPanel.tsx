'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  FileUp,
  Info,
  Loader2,
  Sheet as SheetIcon,
} from 'lucide-react';
import { downloadBlob } from '@/lib/downloadBlob';
import { buildDescargasXml, descargasFileName } from '@/lib/descargas/buildXml';
import { readDescargasXlsx } from '@/lib/descargas/readXlsx';
import { REQUIRED_COLUMNS } from '@/lib/descargas/fields';
import type { DescargaReadResult } from '@/lib/descargas/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const TXT_MIME = 'text/plain;charset=utf-8';

/** Columns worth showing in the preview: the required ones plus two useful extras. */
const PREVIEW_COLS = [...REQUIRED_COLUMNS, 'COMPRADOR', 'CORREDOR'] as const;

/**
 * Standalone flow: take one Excel already in the "base" shape (15 columns,
 * named exactly like the XML tags — see `base_descargas.xlsx`) and download
 * the XML straight away. Works for a file produced by `SourceUploader`,
 * hand-filled from the template, or edited afterwards.
 */
export default function BaseXlsxToXmlPanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<DescargaReadResult | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setFileName(file.name);
      setResult(null);
      setXml(null);
      setGenError(null);
      setIsReading(true);
      try {
        setResult(await readDescargasXlsx(file));
      } catch (err) {
        setResult({
          rows: [],
          headers: [],
          missingRequired: [],
          unknownColumns: [],
          missingOptional: [],
          fatal: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsReading(false);
      }
    },
    [],
  );

  const generateAndDownload = useCallback(() => {
    if (!result) return;
    setGenError(null);
    try {
      const generated = buildDescargasXml(result.rows);
      setXml(generated);
      downloadBlob(new Blob([generated], { type: TXT_MIME }), descargasFileName());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
  }, [result]);

  const rowCount = result?.rows.length ?? 0;
  const missingRequired = result?.missingRequired ?? [];
  const unknownColumns = result?.unknownColumns ?? [];
  const missingOptional = result?.missingOptional ?? [];
  const allClear = !!result && missingRequired.length === 0 && unknownColumns.length === 0;
  const canGenerate = !!result && !result.fatal && rowCount > 0 && missingRequired.length === 0;

  const previewRows = useMemo(() => result?.rows.slice(0, 15) ?? [], [result]);

  return (
    <Card className="bg-muted/30 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-foreground/10">
          <SheetIcon className="size-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Convertir un Excel base a TXT
          </h2>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
            Subí un Excel que ya tenga las 15 columnas del formato base (CTG,
            CPORTE, FECHA…) y descargá el TXT directo. No necesita el paso
            anterior.
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
          {isReading ? <Loader2 className="animate-spin" /> : <FileUp />}
          {isReading ? 'Leyendo…' : 'Elegir archivo .xlsx'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
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
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{rowCount}</span>{' '}
            fila{rowCount === 1 ? '' : 's'} · {' '}
            <span className="font-semibold text-foreground">
              {result.headers.length}
            </span>{' '}
            columnas encontradas
          </p>

          <ul className="flex w-full flex-col gap-1.5">
            {missingRequired.length > 0 && (
              <li className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Faltan columnas obligatorias: {missingRequired.join(', ')}
              </li>
            )}
            {unknownColumns.length > 0 && (
              <li className="flex items-start gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-sm text-primary">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Columnas no reconocidas (se ignoran): {unknownColumns.join(', ')}
              </li>
            )}
            {missingOptional.length > 0 && (
              <li className="flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Columnas opcionales no presentes (usan su valor por defecto):{' '}
                {missingOptional.join(', ')}
              </li>
            )}
            {allClear && (
              <li className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-sm text-success">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Todo en orden
              </li>
            )}
          </ul>

          {rowCount > 0 && (
            <Card className="w-full gap-0 p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {PREVIEW_COLS.map((c) => (
                        <TableHead
                          key={c}
                          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {PREVIEW_COLS.map((c) => (
                          <TableCell key={c} className="max-w-40 truncate">
                            {row[c] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <Button type="button" disabled={!canGenerate} onClick={generateAndDownload}>
            <FileCode2 />
            Descargar TXT{rowCount ? ` (${rowCount})` : ''}
          </Button>

          {xml && (
            <div className="flex w-full flex-col gap-2">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary">
                  <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                  Ver contenido generado
                </summary>
                <Textarea
                  readOnly
                  value={xml}
                  className="mt-2 h-56 animate-in resize-y font-mono text-xs fade-in-0 duration-300"
                />
              </details>
            </div>
          )}

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
