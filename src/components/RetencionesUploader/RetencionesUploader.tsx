'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileCode2,
  Loader2,
  Sheet as SheetIcon,
  Upload,
  X,
} from 'lucide-react';
import {
  buildWorkbook,
  downloadBlob,
  retencionesFileName,
} from '@/lib/retenciones/buildWorkbook';
import { buildXml, retencionesXmlFileName } from '@/lib/retenciones/buildXml';
import { extractPdfText } from '@/lib/retenciones/extractPdfText';
import { parseRetencion } from '@/lib/retenciones/parseRetencion';
import type { FileResult, RetencionRow } from '@/lib/retenciones/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import XlsxToXmlPanel from './XlsxToXmlPanel';

const TXT_MIME = 'text/plain;charset=utf-8';
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

  /** Edit CONTRATO/ORDENINTER directly in the preview — they never come from the PDF. */
  const updateRowField = useCallback(
    (id: string, field: 'contrato' | 'ordenInter', raw: string) => {
      const value = raw.replace(/\D/g, '');
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id && e.result?.row
            ? {
                ...e,
                result: { ...e.result, row: { ...e.result.row, [field]: value } },
              }
            : e,
        ),
      );
    },
    [],
  );

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

  const okEntries = useMemo(
    () => entries.filter((e) => e.result?.status === 'ok' && e.result.row),
    [entries],
  );
  const okRows = useMemo(
    () => okEntries.map((e) => e.result!.row!),
    [okEntries],
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
          contrato: r.contrato,
          ordenInter: r.ordenInter,
          liqCorrelDgi: r.liqCorrelDgi,
          fecha: r.fechaOrigen,
          importe: r.impSinIva,
          cuitCorredor: r.cuitCorredor,
          concepto: r.conceptoRetIva,
        })),
      );
      const blob = new Blob([xml], { type: TXT_MIME });
      downloadBlob(blob, retencionesXmlFileName());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
  }, [okRows]);

  const okCount = okRows.length;

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Retenciones"
        description="Arrastrá las constancias y descargá el Excel o el TXT."
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 sm:p-6">
        <section className="flex flex-col gap-4">
          <div
            className={cn(
              'group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-[border-color,background-color,transform] duration-200',
              'hover:border-primary/40 hover:bg-muted/40',
              isDragging && 'scale-[1.01] border-primary bg-primary/5',
            )}
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
            <span className="mb-1 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
              <Upload className="size-6" />
            </span>
            <p className="text-base font-medium text-foreground">
              Arrastrá los PDF acá
            </p>
            <p className="text-sm text-muted-foreground">
              o <span className="font-medium text-primary underline underline-offset-2">elegilos de tu computadora</span>
              {' · '}podés cargar varios a la vez
            </p>
          </div>

          {entries.length > 0 && (
            <Card className="animate-in gap-0 fade-in-0 p-0 duration-300">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-medium text-muted-foreground">
                <span>
                  {entries.length} archivo{entries.length === 1 ? '' : 's'}
                  {isParsing && (
                    <span className="text-primary"> · leyendo…</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Quitar todos
                </Button>
              </div>

              <ul className="max-h-[180px] overflow-y-auto">
                {entries.map((entry, i) => {
                  const status = entry.parsing
                    ? 'parsing'
                    : (entry.result?.status ?? 'error');
                  return (
                    <li
                      key={entry.id}
                      className="flex animate-in items-start gap-3 border-b border-border px-4 py-3 fade-in slide-in-from-bottom-1 duration-300 last:border-0"
                      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    >
                      <span
                        key={status}
                        className={cn(
                          'mt-0.5 grid size-7 shrink-0 animate-in place-items-center rounded-md zoom-in-75 duration-200',
                          status === 'ok' && 'bg-success/10 text-success',
                          status === 'error' &&
                            'bg-destructive/10 text-destructive',
                          status === 'parsing' &&
                            'bg-muted text-muted-foreground',
                        )}
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
                          <Loader2 className="size-4 animate-spin" />
                        ) : status === 'ok' ? (
                          <Check className="size-4" />
                        ) : (
                          <AlertTriangle className="size-3.5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {entry.file.name}
                        </span>
                        {status === 'ok' && (
                          <span className="text-xs text-success">
                            Listo para exportar
                          </span>
                        )}
                        {entry.result?.status === 'error' &&
                          entry.result.errors && (
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              {entry.result.errors.map((err, j) => (
                                <li
                                  key={j}
                                  className="text-xs leading-relaxed text-destructive"
                                >
                                  {err.field !== 'text' ? `${err.field}: ` : ''}
                                  {err.message}
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeEntry(entry.id)}
                        aria-label={`Quitar ${entry.file.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {okCount > 0 && (
            <Card className="animate-in gap-0 fade-in-0 p-0 duration-300">
              <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
                <div>
                  <CardTitle className="text-sm">Vista previa</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Completá Contrato y Orden Inter acá para exportar el registro completo.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {okCount} fila{okCount === 1 ? '' : 's'}
                </span>
              </div>
              <Table containerClassName="max-h-[424px] overflow-y-auto">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-1 text-right text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Contrato
                    </TableHead>
                    <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Orden inter
                    </TableHead>
                    {PREVIEW_COLS.map((c) => (
                      <TableHead
                        key={c.header}
                        className={cn(
                          'text-xs font-semibold tracking-wide text-muted-foreground uppercase',
                          c.numeric && 'text-right',
                        )}
                      >
                        {c.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {okEntries.map((entry, i) => {
                    const row = entry.result!.row!;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.contrato}
                            onChange={(e) =>
                              updateRowField(entry.id, 'contrato', e.target.value)
                            }
                            inputMode="numeric"
                            placeholder="—"
                            className="h-8 w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.ordenInter}
                            onChange={(e) =>
                              updateRowField(entry.id, 'ordenInter', e.target.value)
                            }
                            inputMode="numeric"
                            placeholder="—"
                            className="h-8 w-28"
                          />
                        </TableCell>
                        {PREVIEW_COLS.map((c) => (
                          <TableCell
                            key={c.header}
                            className={cn(c.numeric && 'text-right tabular-nums')}
                          >
                            {c.get(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          {entries.length > 0 && (
            <div className="flex flex-col items-start gap-3 pt-1">
              {errorCount > 0 && (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                  <Checkbox
                    checked={skipFailed}
                    onCheckedChange={(checked) => setSkipFailed(checked === true)}
                  />
                  <span>
                    Generar igual, omitiendo {errorCount} archivo
                    {errorCount === 1 ? '' : 's'} con error
                    {errorCount === 1 ? '' : 'es'}
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                >
                  {isGenerating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <SheetIcon />
                  )}
                  {isGenerating
                    ? 'Generando…'
                    : `Descargar Excel${okCount ? ` (${okCount})` : ''}`}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={okCount === 0 || isParsing || isGenerating}
                  onClick={generateXml}
                >
                  <FileCode2 />
                  Descargar TXT{okCount ? ` (${okCount})` : ''}
                </Button>
              </div>

              {genError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
                  <AlertTriangle className="size-4" />
                  {genError}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          <span>¿ya tenés un Excel?</span>
          <Separator className="flex-1" />
        </div>

        <XlsxToXmlPanel />
      </main>

      <footer className="border-t border-border p-6 text-center text-xs text-muted-foreground">
        Coopagro · IVA Rég. Granos RG AFIP 2300
      </footer>
    </div>
  );
}
