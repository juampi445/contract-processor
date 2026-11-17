'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileCode2,
  FileUp,
  Loader2,
  Sheet as SheetIcon,
} from 'lucide-react';
import {
  loadMolinoMap,
  nameResolverFrom,
  type MolinoMap,
} from '@/lib/molinos/molinos';
import {
  exportXmlBatch,
  findExistingExports,
  type ExistingExport,
  type XmlBatchItem,
} from '@/lib/retenciones/historial';
import { readXlsx, type XlsxReadResult } from '@/lib/retenciones/readXlsx';
import { registrosBloqueados } from '@/lib/retenciones/requeridos';
import { useCompany } from '@/components/company-provider';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BlockedNotice,
  DuplicateWarning,
  SaveIndicator,
  type SaveState,
} from './HistorialFeedback';

/**
 * Standalone flow: take one filled XLSX (produced earlier by this tool,
 * possibly hand-edited) and download the corresponding XML. Works with zero
 * PDFs loaded and never shares data with the in-memory flow.
 *
 * It goes to BIT exactly like the PDF batch, so it runs the SAME export path
 * (`exportXmlBatch`): same required fields, same validations, same histórico.
 */
export default function XlsxToXmlPanel() {
  const company = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<XlsxReadResult | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [duplicates, setDuplicates] = useState<ExistingExport[] | null>(null);
  const [emisores, setEmisores] = useState<MolinoMap>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setFileName(file.name);
      setResult(null);
      setGenError(null);
      setSaveState({ status: 'idle' });
      setDuplicates(null);
      setSkipErrors(false);
      setIsReading(true);
      try {
        setResult(await readXlsx(file));
      } catch (err) {
        setResult({
          rows: [],
          rowNumbers: [],
          errors: [],
          fatal: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsReading(false);
      }
    },
    [],
  );

  // Resolve the mills of the file from the catalog.
  useEffect(() => {
    if (!result || result.rows.length === 0) return;
    let cancelled = false;
    loadMolinoMap(supabase, result.rows.map((r) => r.cuitCorredor))
      .then((map) => {
        if (!cancelled) setEmisores(map);
      })
      .catch(() => {
        // Names are a courtesy; the rows are saved with their CUIT regardless.
      });
    return () => {
      cancelled = true;
    };
  }, [result, supabase]);

  /**
   * Rows the XML cannot carry (typically CONTRATO / ORDENINTER left blank in
   * the spreadsheet). They are shown with their Excel row number; the user can
   * fix the file, or generate the XML without them.
   */
  const bloqueados = useMemo(
    () => (result ? registrosBloqueados(result.rows) : []),
    [result],
  );
  const blockedIndexes = useMemo(() => new Set(bloqueados.map((b) => b.index)), [bloqueados]);

  /** The rows that will actually go into the XML. */
  const exportable = useMemo(
    () => (result ? result.rows.filter((_, i) => !blockedIndexes.has(i)) : []),
    [result, blockedIndexes],
  );

  const exportXmlAndSave = useCallback(async () => {
    if (!result) return;
    setGenError(null);
    setDuplicates(null);

    // Every row of an Excel is saveable: the 5% check needs the base amount,
    // which a spreadsheet does not carry, so there is nothing to flag here.
    const items: XmlBatchItem[] = exportable.map((input) => ({
      input,
      sourceFilename: fileName,
      saveable: true,
    }));

    setSaveState({ status: 'saving' });
    try {
      const outcome = await exportXmlBatch(
        supabase,
        company.id,
        items,
        nameResolverFrom(emisores),
      );
      setSaveState(
        outcome.saveError
          ? { status: 'error', message: outcome.saveError }
          : {
              status: 'saved',
              saved: outcome.saved,
              updated: outcome.updated,
              skipped: outcome.skipped,
            },
      );
    } catch (err) {
      setSaveState({ status: 'idle' });
      setGenError(err instanceof Error ? err.message : String(err));
    }
  }, [result, exportable, fileName, supabase, company.id, emisores]);

  const generate = useCallback(async () => {
    if (!result) return;
    setGenError(null);
    setSaveState({ status: 'idle' });

    let existing: ExistingExport[] = [];
    try {
      existing = await findExistingExports(
        supabase,
        company.id,
        exportable.map((r) => r.concepto),
      );
    } catch {
      // The check is a courtesy. If it fails, exporting still has to work.
    }

    if (existing.length > 0) {
      setDuplicates(existing);
      return;
    }
    await exportXmlAndSave();
  }, [result, exportable, supabase, company.id, exportXmlAndSave]);

  const readErrorCount = result?.errors.length ?? 0;
  const blockedCount = bloqueados.length;
  const problemCount = readErrorCount + blockedCount;
  const validCount = exportable.length;
  const isSaving = saveState.status === 'saving';
  const canGenerate =
    !!result &&
    !result.fatal &&
    validCount > 0 &&
    (problemCount === 0 || skipErrors) &&
    !isSaving &&
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
              {validCount} fila{validCount === 1 ? '' : 's'} lista
              {validCount === 1 ? '' : 's'} para el XML
            </span>
            {problemCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3" />
                {problemCount} con problema{problemCount === 1 ? '' : 's'}
              </span>
            )}
          </p>

          {readErrorCount > 0 && (
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

          <BlockedNotice
            bloqueados={bloqueados}
            label={(index) => `Fila ${result.rowNumbers[index] ?? index + 2} del Excel`}
          />

          {problemCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox
                checked={skipErrors}
                onCheckedChange={(checked) => setSkipErrors(checked === true)}
              />
              <span>
                Generar igual, omitiendo {problemCount} fila
                {problemCount === 1 ? '' : 's'} con problema{problemCount === 1 ? '' : 's'}
              </span>
            </label>
          )}

          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() => void generate()}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FileCode2 />
            )}
            {isSaving
              ? 'Generando…'
              : `Descargar XML${validCount ? ` (${validCount})` : ''}`}
          </Button>

          <p className="text-xs text-muted-foreground">
            Al descargar el XML, el lote queda guardado en el histórico, con las
            mismas validaciones que las constancias en PDF.
          </p>

          {duplicates && (
            <DuplicateWarning
              duplicates={duplicates}
              onCancel={() => setDuplicates(null)}
              onConfirm={() => void exportXmlAndSave()}
            />
          )}

          <SaveIndicator state={saveState} />

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
