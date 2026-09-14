'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  ChartColumn,
  Check,
  CheckCircle2,
  ChevronDown,
  FileCode2,
  Loader2,
  Sheet as SheetIcon,
  Table2,
  Upload,
} from 'lucide-react';
import { downloadBlob } from '@/lib/downloadBlob';
import {
  baseDescargasFileName,
  buildBaseWorkbook,
} from '@/lib/descargas/buildBaseWorkbook';
import { buildDescargasXml, descargasFileName } from '@/lib/descargas/buildXml';
import {
  extractSourceRows,
  mergeWithManualValues,
} from '@/lib/descargas/extractSource';
import { parseQuantity } from '@/lib/descargas/numbers';
import {
  createPreset,
  loadLastPresetId,
  loadPresets,
  normalizePresetValues,
  presetValuesEqual,
  saveLastPresetId,
  savePresets,
  type DescargasPreset,
  type DescargasPresetValues,
} from '@/lib/descargas/presets';
import {
  readSourceWorkbook,
  type SourceMatrix,
} from '@/lib/descargas/readSourceWorkbook';
import {
  BASE_COLUMNS,
  DEFAULT_COLUMN_NAMES,
  DEFAULT_REQUIRED_FLAGS,
  MAPPABLE_COLUMNS,
  optionalBaseColumns,
  TOGGLEABLE_COLUMNS,
  type BaseColumn,
  type MappableColumn,
} from '@/lib/descargas/sourceFields';
import { loadPref, REVIEW_TAB_KEY, savePref } from '@/lib/descargas/uiPrefs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import PresetBar from './PresetBar';

// Recharts only loads when someone opens the "Gráficos" tab.
const ReviewCharts = dynamic(() => import('./ReviewCharts'), {
  ssr: false,
  loading: () => (
    <div className="h-[34rem] animate-pulse rounded-xl bg-muted/40" aria-hidden />
  ),
});

const TXT_MIME = 'text/plain;charset=utf-8';
const PREVIEW_LIMIT = 15;

type ReviewTab = 'tabla' | 'graficos';

/** "ddmmyyyy" → "dd/mm/yyyy" for display only; the stored value is untouched. */
function formatFecha(value: string): string {
  const m = value.match(/^(\d{2})(\d{2})(\d{4})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : value;
}

function truncateValue(value: string, max = 8): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

type StepStatus = 'todo' | 'done' | 'error';

function StepBadge({ step, status = 'todo' }: { step: number; status?: StepStatus }) {
  return (
    <span
      className={cn(
        'mt-px grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200',
        status === 'done' && 'bg-success/15 text-success',
        status === 'error' && 'bg-destructive/15 text-destructive',
        status === 'todo' && 'bg-primary text-primary-foreground',
      )}
      aria-hidden
    >
      {status === 'done' ? (
        <Check className="size-3.5" />
      ) : status === 'error' ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        step
      )}
    </span>
  );
}

const STATUS_PILL: Record<StepStatus, string> = {
  todo: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
};

function SummaryChip({ label, value }: { label: string; value?: string }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs leading-5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {value !== undefined && (
        <span className="truncate font-medium text-foreground">{value}</span>
      )}
    </span>
  );
}

function StepHeading({
  step,
  title,
  description,
  done = false,
}: {
  step: number;
  title: string;
  description?: ReactNode;
  done?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4">
      <StepBadge step={step} status={done ? 'done' : 'todo'} />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          <span className="sr-only">Paso {step}: </span>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 max-w-[68ch] text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A step on its own surface whose whole header opens and closes it. The
 * header always carries the step's status; open, it shows the description,
 * closed, chips summarizing what's inside.
 */
function CollapsibleStep({
  step,
  title,
  description,
  summary,
  status,
  statusLabel,
  open,
  onOpenChange,
  animate,
  className,
  children,
}: {
  step: number;
  title: string;
  description: ReactNode;
  summary: ReactNode;
  status: StepStatus;
  statusLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Off until the page settles, so the first render doesn't animate. */
  animate: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-150',
        status === 'error'
          ? 'border-destructive/40'
          : 'border-border hover:border-foreground/15',
        open && 'shadow-sm',
        className,
      )}
    >
      <h2 className="text-sm">
        <CollapsibleTrigger className="group/trigger flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset active:bg-muted/60">
          <StepBadge step={step} status={status} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold tracking-tight text-foreground">
                <span className="sr-only">Paso {step}: </span>
                {title}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium',
                  STATUS_PILL[status],
                )}
              >
                {statusLabel}
              </span>
            </span>
            {open ? (
              <span className="max-w-[68ch] text-xs font-normal text-muted-foreground">
                {description}
              </span>
            ) : (
              <span className="flex min-w-0 flex-wrap gap-1.5 font-normal">{summary}</span>
            )}
          </span>
          <span
            className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 group-hover/trigger:bg-muted group-hover/trigger:text-foreground"
            aria-hidden
          >
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            />
          </span>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent
        className={cn(
          'h-(--collapsible-panel-height) overflow-hidden data-[ending-style]:h-0 data-[starting-style]:h-0',
          animate &&
            'transition-[height] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
        )}
      >
        <div className="border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function SourceUploader() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [matrix, setMatrix] = useState<SourceMatrix | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [columnNames, setColumnNames] =
    useState<Record<MappableColumn, string>>(DEFAULT_COLUMN_NAMES);
  const [requiredFlags, setRequiredFlags] =
    useState<Record<MappableColumn, boolean>>(DEFAULT_REQUIRED_FLAGS);
  const [manualValues, setManualValues] = useState<Partial<Record<BaseColumn, string>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [presets, setPresets] = useState<DescargasPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [mappingOpen, setMappingOpen] = useState(true);
  const [batchOpen, setBatchOpen] = useState(true);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('tabla');
  const [animateSteps, setAnimateSteps] = useState(false);
  /** Bumped when a preset is picked or a file loads: the moments that re-decide which steps open. */
  const [layoutToken, setLayoutToken] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const applyValues = useCallback((values: DescargasPresetValues) => {
    const normalized = normalizePresetValues(values);
    setColumnNames(normalized.columnNames);
    setRequiredFlags(normalized.requiredFlags);
    setManualValues(normalized.manualValues);
  }, []);

  // localStorage only exists in the browser, so presets and UI prefs load after mount.
  useEffect(() => {
    const stored = loadPresets();
    setPresets(stored);
    const last = stored.find((p) => p.id === loadLastPresetId());
    if (last) {
      applyValues(last);
      setSelectedPresetId(last.id);
    }
    setLayoutToken((t) => t + 1);
    if (loadPref(REVIEW_TAB_KEY) === 'graficos') setReviewTab('graficos');
    // Two frames: let the steps settle open or closed before enabling animation.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setAnimateSteps(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [applyValues]);

  const currentValues = useMemo<DescargasPresetValues>(
    () => ({ columnNames, requiredFlags, manualValues }),
    [columnNames, requiredFlags, manualValues],
  );
  const selectedPreset = presets.find((p) => p.id === selectedPresetId) ?? null;
  const isPresetDirty =
    !!selectedPreset && !presetValuesEqual(selectedPreset, currentValues);

  const persistPresets = useCallback(
    (next: DescargasPreset[], selectedId: string | null) => {
      const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      setPresets(sorted);
      setSelectedPresetId(selectedId);
      saveLastPresetId(selectedId);
      return savePresets(sorted);
    },
    [],
  );

  const selectPreset = useCallback(
    (id: string | null) => {
      const preset = presets.find((p) => p.id === id);
      applyValues(
        preset ?? {
          columnNames: DEFAULT_COLUMN_NAMES,
          requiredFlags: DEFAULT_REQUIRED_FLAGS,
          manualValues: {},
        },
      );
      setSelectedPresetId(preset?.id ?? null);
      saveLastPresetId(preset?.id ?? null);
      setLayoutToken((t) => t + 1);
    },
    [presets, applyValues],
  );

  const saveAsPreset = useCallback(
    (name: string) => {
      const key = name.trim().toLowerCase();
      const existing = presets.find((p) => p.name.trim().toLowerCase() === key);
      if (existing) {
        const replaced = { ...createPreset(name, currentValues), id: existing.id };
        return persistPresets(
          presets.map((p) => (p.id === existing.id ? replaced : p)),
          existing.id,
        );
      }
      const created = createPreset(name, currentValues);
      return persistPresets([...presets, created], created.id);
    },
    [presets, currentValues, persistPresets],
  );

  const updateSelectedPreset = useCallback(() => {
    if (!selectedPreset) return false;
    const updated = { ...createPreset(selectedPreset.name, currentValues), id: selectedPreset.id };
    return persistPresets(
      presets.map((p) => (p.id === selectedPreset.id ? updated : p)),
      selectedPreset.id,
    );
  }, [presets, selectedPreset, currentValues, persistPresets]);

  const deleteSelectedPreset = useCallback(() => {
    if (!selectedPreset) return false;
    return persistPresets(
      presets.filter((p) => p.id !== selectedPreset.id),
      null,
    );
  }, [presets, selectedPreset, persistPresets]);

  const readFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setMatrix(null);
    setReadError(null);
    setGenError(null);
    setIsReading(true);
    try {
      setMatrix(await readSourceWorkbook(file));
      setLayoutToken((t) => t + 1);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void readFile(file);
    },
    [readFile],
  );

  const onSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void readFile(file);
    },
    [readFile],
  );

  const setColumnName = useCallback((field: MappableColumn, value: string) => {
    setColumnNames((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setRequiredFlag = useCallback((field: MappableColumn, value: boolean) => {
    setRequiredFlags((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setManualValue = useCallback((field: BaseColumn, value: string) => {
    setManualValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const selectReviewTab = useCallback((value: unknown) => {
    const tab: ReviewTab = value === 'graficos' ? 'graficos' : 'tabla';
    setReviewTab(tab);
    savePref(REVIEW_TAB_KEY, tab);
  }, []);

  const requiredFields = useMemo(
    () => TOGGLEABLE_COLUMNS.filter((f) => requiredFlags[f]),
    [requiredFlags],
  );

  const extract = useMemo(
    () => (matrix ? extractSourceRows(matrix, columnNames, requiredFields) : null),
    [matrix, columnNames, requiredFields],
  );

  const detectedFields = extract?.detectedFields ?? new Set<BaseColumn>();
  const rowCount = extract?.rows.length ?? 0;
  const skippedRows = extract?.skippedRows ?? 0;
  const missingRequired = extract?.missingRequired ?? [];
  const manualFields = optionalBaseColumns(requiredFields).filter(
    (f) => !detectedFields.has(f),
  );
  const totbrutAvailable =
    detectedFields.has('TOTBRUT') || parseQuantity(manualValues.TOTBRUT) !== null;
  const fileLoaded = !!extract && !extract.fatal;
  const canGenerate = fileLoaded && rowCount > 0 && missingRequired.length === 0;
  const hasBatchStep = fileLoaded && manualFields.length > 0;
  const reviewStep = hasBatchStep ? 4 : 3;
  const mappingError = !!extract && (!!extract.fatal || missingRequired.length > 0);

  const isAutoPesobrut = (field: BaseColumn) => field === 'PESOBRUT' && totbrutAvailable;
  const filledBatchFields = manualFields.filter(
    (f) => !isAutoPesobrut(f) && !!manualValues[f]?.trim(),
  );
  const missingBatchCount = manualFields.filter(
    (f) => !isAutoPesobrut(f) && !manualValues[f]?.trim(),
  ).length;
  const batchComplete = missingBatchCount === 0;

  // Picking (or clearing) a preset and loading a file are when the next task
  // changes, so they re-decide both steps: open what still needs input, close
  // what's settled. Without a preset the mapping always needs checking.
  // Between those moments only a newly appearing problem opens a step, so
  // closing one by hand sticks and filling the last input never collapses it.
  const layoutRef = useRef({ token: 0, mappingError: false, batchComplete: true });
  useEffect(() => {
    const prev = layoutRef.current;
    layoutRef.current = { token: layoutToken, mappingError, batchComplete };
    if (layoutToken !== prev.token) {
      setMappingOpen(!selectedPresetId || mappingError);
      setBatchOpen(!batchComplete);
      return;
    }
    if (mappingError && !prev.mappingError) setMappingOpen(true);
    if (!batchComplete && prev.batchComplete) setBatchOpen(true);
  }, [layoutToken, selectedPresetId, mappingError, batchComplete]);

  const mappingStatus: StepStatus = mappingError
    ? 'error'
    : fileLoaded || selectedPreset
      ? 'done'
      : 'todo';
  const mappingStatusLabel = mappingError
    ? missingRequired.length > 1
      ? `Faltan ${missingRequired.length} columnas`
      : 'Falta una columna'
    : fileLoaded
      ? 'Columnas encontradas'
      : selectedPreset
        ? 'Del preset'
        : 'Por revisar';

  const mappingSummary = useMemo(() => {
    const mapped = MAPPABLE_COLUMNS.filter((f) => columnNames[f].trim());
    const renamed = mapped.filter((f) => columnNames[f].trim() !== f);
    const shown = (renamed.length > 0 ? renamed : mapped).slice(0, 3);
    return (
      <>
        {shown.map((f) => (
          <SummaryChip key={f} label={`${f} →`} value={columnNames[f].trim()} />
        ))}
        {mapped.length > shown.length && (
          <SummaryChip label={`+${mapped.length - shown.length} más`} />
        )}
        <SummaryChip
          label={
            requiredFields.length === 0
              ? 'Ninguna obligatoria'
              : `${requiredFields.length} obligatoria${requiredFields.length === 1 ? '' : 's'}`
          }
        />
      </>
    );
  }, [columnNames, requiredFields]);

  const batchSummary =
    filledBatchFields.length === 0 ? (
      <SummaryChip label="Sin valores cargados" />
    ) : (
      <>
        {filledBatchFields.slice(0, 3).map((f) => (
          <SummaryChip key={f} label={f} value={truncateValue(manualValues[f] ?? '', 12)} />
        ))}
        {filledBatchFields.length > 3 && (
          <SummaryChip label={`+${filledBatchFields.length - 3} más`} />
        )}
      </>
    );

  const mergedRows = useMemo(
    () =>
      extract && !extract.fatal
        ? mergeWithManualValues(extract.rows, detectedFields, manualValues)
        : [],
    [extract, detectedFields, manualValues],
  );
  const previewRows = useMemo(() => mergedRows.slice(0, PREVIEW_LIMIT), [mergedRows]);

  const downloadBase = useCallback(async () => {
    setGenError(null);
    setIsGenerating(true);
    try {
      const blob = await buildBaseWorkbook(mergedRows);
      downloadBlob(blob, baseDescargasFileName());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [mergedRows]);

  const downloadXml = useCallback(() => {
    setGenError(null);
    try {
      const xml = buildDescargasXml(mergedRows);
      downloadBlob(new Blob([xml], { type: TXT_MIME }), descargasFileName());
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
  }, [mergedRows]);

  return (
    <section className="flex flex-col gap-8">
      <PresetBar
        presets={presets}
        selectedId={selectedPresetId}
        isDirty={isPresetDirty}
        onSelect={selectPreset}
        onSaveAs={saveAsPreset}
        onUpdate={updateSelectedPreset}
        onDelete={deleteSelectedPreset}
      />

      {/* Paso 1: the mapping is read when the file is parsed, so it comes first. */}
      <CollapsibleStep
        step={1}
        title="Mapeo de columnas"
        description="Escribí cómo se llama cada columna en el Excel de esta empresa. Si una columna es obligatoria y una fila no la tiene, esa fila se descarta. Podés cambiarlo después de subir el archivo."
        summary={mappingSummary}
        status={mappingStatus}
        statusLabel={mappingStatusLabel}
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        animate={animateSteps}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAPPABLE_COLUMNS.map((field) => {
            const isToggleable = TOGGLEABLE_COLUMNS.includes(field);
            const isRequired = isToggleable && requiredFlags[field];
            return (
              <div
                key={field}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3',
                  missingRequired.includes(field) && 'bg-destructive/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{field}</span>
                  {isToggleable ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Obligatoria
                      <Switch
                        size="sm"
                        checked={requiredFlags[field]}
                        onCheckedChange={(checked) => setRequiredFlag(field, checked === true)}
                      />
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">opcional</span>
                  )}
                </div>
                <Input
                  value={columnNames[field]}
                  onChange={(e) => setColumnName(field, e.target.value)}
                  placeholder={isToggleable ? field : 'no viene en este archivo'}
                  aria-label={`Nombre de la columna ${field} en el Excel`}
                  aria-invalid={missingRequired.includes(field) || undefined}
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  {isToggleable
                    ? isRequired
                      ? 'Sin este valor, la fila no se importa.'
                      : 'Si está, se usa; si falta, no descarta la fila.'
                    : 'Si está, se usa; si no, la completás en los datos del lote.'}
                </p>
              </div>
            );
          })}
        </div>
      </CollapsibleStep>

      {/* Paso 2 */}
      <div className="flex flex-col gap-3">
        <StepHeading
          step={2}
          title="Subí el Excel"
          description="Funciona con el Excel del acopio o del transportista, sea cual sea su formato."
          done={fileLoaded}
        />
        <div
          className={cn(
            'group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border text-center transition-[border-color,background-color,transform,padding] duration-200',
            'hover:border-primary/40 hover:bg-muted/40',
            fileLoaded ? 'px-6 py-6' : 'px-6 py-10',
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
            accept=".xlsx,.xls,.xlsm"
            hidden
            onChange={onSelect}
          />
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
            {isReading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
          </span>
          <p className="text-base font-medium text-foreground">
            {isReading
              ? 'Leyendo…'
              : fileName
                ? 'Arrastrá otro Excel para reemplazarlo'
                : 'Arrastrá el Excel acá'}
          </p>
          <p className="text-sm text-muted-foreground">
            o <span className="font-medium text-primary underline underline-offset-2">elegilo de tu computadora</span>
          </p>
          {fileName && (
            <span className="mt-1 max-w-full truncate text-sm text-muted-foreground">
              {fileName}
            </span>
          )}
        </div>

        {readError && (
          <p
            className="flex animate-in items-center gap-1.5 text-sm text-destructive fade-in-0 duration-300"
            role="alert"
          >
            <AlertTriangle className="size-4" />
            {readError}
          </p>
        )}

        {extract?.fatal && (
          <p
            className="flex animate-in items-center gap-1.5 text-sm text-destructive fade-in-0 duration-300"
            role="alert"
          >
            <AlertTriangle className="size-4" />
            {extract.fatal}
          </p>
        )}

        {fileLoaded && (
          <>
            <p className="animate-in text-sm text-muted-foreground fade-in-0 duration-300">
              <span className="font-semibold text-foreground">{rowCount}</span>{' '}
              descarga{rowCount === 1 ? '' : 's'} cargada{rowCount === 1 ? '' : 's'} · columnas
              usadas:{' '}
              <span className="font-medium text-foreground">
                {[...detectedFields].join(', ')}
              </span>
            </p>

            {skippedRows > 0 && (
              <p className="flex animate-in items-start gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm text-muted-foreground fade-in-0 duration-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Se omitieron {skippedRows} fila{skippedRows === 1 ? '' : 's'} por no tener
                completo alguno de los valores marcados como obligatorios (
                {requiredFields.join(', ')}).
              </p>
            )}
          </>
        )}
      </div>

      {hasBatchStep && (
        <CollapsibleStep
          step={3}
          title="Datos del lote"
          description={
            selectedPreset
              ? `No vienen en el Excel y se aplican a todas las filas. Se completaron con el preset «${selectedPreset.name}».`
              : 'No vienen en el Excel y se aplican a todas las filas de esta carga.'
          }
          summary={batchSummary}
          status={batchComplete ? 'done' : 'todo'}
          statusLabel={
            batchComplete
              ? 'Completo'
              : missingBatchCount === 1
                ? 'Falta 1 dato'
                : `Faltan ${missingBatchCount} datos`
          }
          open={batchOpen}
          onOpenChange={setBatchOpen}
          animate={animateSteps}
          className="animate-in fade-in-0 duration-300"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {manualFields.map((field) => {
              const auto = isAutoPesobrut(field);
              return (
                <label key={field} className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="font-medium text-foreground">{field}</span>
                  <Input
                    value={auto ? '' : (manualValues[field] ?? '')}
                    onChange={(e) => setManualValue(field, e.target.value)}
                    placeholder={auto ? 'Automático: TOTBRUT + TOTNETO' : '-'}
                    disabled={auto}
                    className="h-8"
                  />
                </label>
              );
            })}
          </div>
        </CollapsibleStep>
      )}

      {fileLoaded && (
        <div className="flex animate-in flex-col gap-3 fade-in-0 duration-300">
          <StepHeading
            step={reviewStep}
            title="Revisá y descargá"
            description="Controlá los datos antes de exportar."
          />

          <Tabs value={reviewTab} onValueChange={selectReviewTab} className="gap-3">
            <TabsList>
              <TabsTrigger value="tabla" className="px-2.5">
                <Table2 />
                Tabla
              </TabsTrigger>
              <TabsTrigger value="graficos" className="px-2.5">
                <ChartColumn />
                Gráficos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tabla">
              <Card className="gap-0 p-0">
                <Table containerClassName="max-h-[424px] overflow-y-auto">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-transparent">
                      {BASE_COLUMNS.map((c) => (
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
                        {BASE_COLUMNS.map((c) => (
                          <TableCell key={c} className="max-w-40 truncate">
                            {c === 'FECHA' ? formatFecha(row[c] ?? '') : (row[c] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rowCount > PREVIEW_LIMIT && (
                  <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    Mostrando {PREVIEW_LIMIT} de {rowCount} filas.
                  </p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="graficos">
              <ReviewCharts
                rows={mergedRows}
                skippedRows={skippedRows}
                humidityFromFile={detectedFields.has('PORHUME')}
                humidityColumnName={columnNames.PORHUME}
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              disabled={!canGenerate || isGenerating}
              onClick={() => void downloadBase()}
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : <SheetIcon />}
              {isGenerating ? 'Generando…' : `Descargar Excel base${rowCount ? ` (${rowCount})` : ''}`}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={!canGenerate}
              onClick={downloadXml}
            >
              <FileCode2 />
              Descargar TXT{rowCount ? ` (${rowCount})` : ''}
            </Button>

            {canGenerate && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                Listo para exportar
              </span>
            )}
          </div>

          {isPresetDirty && selectedPreset && (
            <p className="text-xs text-muted-foreground">
              Cambiaste valores del preset «{selectedPreset.name}». Guardalos arriba si los vas
              a volver a usar.
            </p>
          )}

          {genError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="size-4" />
              {genError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
