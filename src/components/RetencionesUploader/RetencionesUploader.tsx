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
import { extractPdfPages } from '@/lib/retenciones/extractPdfText';
import { parseRetencionPages } from '@/lib/retenciones/parseDocument';
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

const XML_MIME = 'application/xml;charset=utf-8';
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

/**
 * A file plus its (possibly pending) parse outcome, kept in selection order.
 * One file yields one result per certificate — a molinocañuelas PDF carries
 * several — so the outcome is a list, and the file is in error when any of them
 * is.
 */
interface Entry {
  id: string;
  file: File;
  parsing: boolean;
  results?: FileResult[];
}

/** The status shown for a file: the worst of its certificates. */
function entryStatus(entry: Entry): 'parsing' | 'ok' | 'error' {
  if (entry.parsing) return 'parsing';
  if (!entry.results?.length) return 'error';
  return entry.results.some((r) => r.status === 'error') ? 'error' : 'ok';
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

/** Parse a single file into one `FileResult` per certificate. Never throws. */
async function parseFile(id: string, file: File): Promise<FileResult[]> {
  const fail = (message: string): FileResult[] => [
    {
      id,
      fileName: file.name,
      status: 'error',
      errors: [{ field: 'text', message }],
    },
  ];

  try {
    const pages = await extractPdfPages(file);
    if (pages.join(' ').trim().length < 50) {
      return fail('PDF sin capa de texto (no soportado, requiere OCR)');
    }

    return parseRetencionPages(pages).map(({ page, result }, i) => ({
      id: `${id}:${i}`,
      fileName: file.name,
      page: page ?? undefined,
      ...(result.ok
        ? { status: 'ok' as const, row: result.row, warnings: result.warnings }
        : { status: 'error' as const, errors: result.errors }),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`No se pudo leer el PDF: ${message}`);
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

  /**
   * Edit CONTRATO/ORDENINTER directly in the preview. ORDENINTER never comes
   * from the PDF; CONTRATO does on two formats, and is overwritable here.
   * Keyed by result id, since a file can hold several certificates.
   */
  const updateRowField = useCallback(
    (resultId: string, field: 'contrato' | 'ordenInter', raw: string) => {
      const value = raw.replace(/\D/g, '');
      setEntries((prev) =>
        prev.map((e) =>
          e.results?.some((r) => r.id === resultId)
            ? {
                ...e,
                results: e.results.map((r) =>
                  r.id === resultId && r.row
                    ? { ...r, row: { ...r.row, [field]: value } }
                    : r,
                ),
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
        const results = await parseFile(entry.id, entry.file);
        patchEntry(entry.id, { parsing: false, results });
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

  /** Every successfully parsed certificate, flattened across files. */
  const okResults = useMemo(
    () =>
      entries.flatMap(
        (e) => e.results?.filter((r) => r.status === 'ok' && r.row) ?? [],
      ),
    [entries],
  );
  const okRows = useMemo(() => okResults.map((r) => r.row!), [okResults]);

  const isParsing = entries.some((e) => e.parsing);
  const errorCount = entries.filter((e) => entryStatus(e) === 'error').length;
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
      const blob = new Blob([xml], { type: XML_MIME });
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
        description="Arrastrá las constancias y descargá el Excel o el XML."
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
                  const status = entryStatus(entry);
                  const certificates = entry.results ?? [];
                  const okHere = certificates.filter(
                    (r) => r.status === 'ok',
                  ).length;
                  const problems = certificates.flatMap((r) => [
                    ...(r.errors ?? []).map((e) => ({
                      key: `${r.id}-e-${e.field}`,
                      page: r.page,
                      text: `${e.field !== 'text' ? `${e.field}: ` : ''}${e.message}`,
                      blocking: true,
                    })),
                    ...(r.warnings ?? []).map((w, k) => ({
                      key: `${r.id}-w-${k}`,
                      page: r.page,
                      text: w,
                      blocking: false,
                    })),
                  ]);
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
                            {okHere > 1
                              ? `${okHere} certificados listos para exportar`
                              : 'Listo para exportar'}
                          </span>
                        )}
                        {problems.length > 0 && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {problems.map((p) => (
                              <li
                                key={p.key}
                                className={cn(
                                  'text-xs leading-relaxed',
                                  p.blocking
                                    ? 'text-destructive'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {p.page ? `pág. ${p.page} — ` : ''}
                                {p.text}
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
                  {okResults.map((result, i) => {
                    const row = result.row!;
                    const flagged = (result.warnings?.length ?? 0) > 0;
                    return (
                      <TableRow
                        key={result.id}
                        className={cn(flagged && 'bg-muted/50')}
                        title={result.warnings?.join('\n')}
                      >
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.contrato}
                            onChange={(e) =>
                              updateRowField(result.id, 'contrato', e.target.value)
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
                              updateRowField(result.id, 'ordenInter', e.target.value)
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
                  Descargar XML{okCount ? ` (${okCount})` : ''}
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
