'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Loader2,
  Sheet as SheetIcon,
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

const TXT_MIME = 'text/plain;charset=utf-8';
const PREVIEW_LIMIT = 15;

/** "ddmmyyyy" → "dd/mm/yyyy" for display only; the stored value is untouched. */
function formatFecha(value: string): string {
  const m = value.match(/^(\d{2})(\d{2})(\d{4})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : value;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setMatrix(null);
    setReadError(null);
    setGenError(null);
    setIsReading(true);
    try {
      setMatrix(await readSourceWorkbook(file));
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
    detectedFields.has('TOTBRUT') ||
    (!!manualValues.TOTBRUT?.trim() && Number.isFinite(Number(manualValues.TOTBRUT)));
  const canGenerate =
    !!extract && !extract.fatal && rowCount > 0 && missingRequired.length === 0;

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
          accept=".xlsx,.xls,.xlsm"
          hidden
          onChange={onSelect}
        />
        <span className="mb-1 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
          {isReading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Upload className="size-6" />
          )}
        </span>
        <p className="text-base font-medium text-foreground">
          {isReading ? 'Leyendo…' : 'Arrastrá el Excel del acopio o transportista acá'}
        </p>
        <p className="text-sm text-muted-foreground">
          o <span className="font-medium text-primary underline underline-offset-2">elegilo de tu computadora</span>
          {' · '}funciona con distintos formatos según la empresa
        </p>
        {fileName && (
          <span className="mt-2 truncate text-sm text-muted-foreground">
            {fileName}
          </span>
        )}
      </div>

      <Card className="gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">Mapeo de columnas</p>
        <p className="-mt-2 text-xs text-muted-foreground">
          Indicá cómo se llama cada columna en <em>este</em> Excel — si mañana la empresa le
          cambia el nombre, solo editás esto, no hace falta tocar nada más. El interruptor
          marca si esa columna es obligatoria: si lo activás y una fila no tiene ese valor,
          la fila se descarta; si lo apagás, la fila se importa igual aunque venga vacía.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAPPABLE_COLUMNS.map((field) => {
            const isToggleable = TOGGLEABLE_COLUMNS.includes(field);
            const isRequired = isToggleable && requiredFlags[field];
            return (
              <div
                key={field}
                className="flex flex-col gap-1.5 rounded-lg border border-border p-3"
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
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">
                  {isToggleable
                    ? isRequired
                      ? 'Sin este valor, la fila no se importa.'
                      : 'Si está, se usa; si falta, no descarta la fila.'
                    : 'Si está, se usa; si no, la completás vos abajo.'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

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

      {extract && !extract.fatal && (
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

          {manualFields.length > 0 && (
            <Card className="animate-in gap-3 p-4 fade-in-0 duration-300">
              <p className="text-sm font-semibold text-foreground">
                Datos del lote
              </p>
              <p className="-mt-2 text-xs text-muted-foreground">
                Estos campos no vienen en el Excel — se aplican a todas las filas de esta carga.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {manualFields.map((field) => {
                  const isAutoPesobrut = field === 'PESOBRUT' && totbrutAvailable;
                  return (
                    <label key={field} className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-foreground">{field}</span>
                      <Input
                        value={isAutoPesobrut ? '' : (manualValues[field] ?? '')}
                        onChange={(e) => setManualValue(field, e.target.value)}
                        placeholder={
                          isAutoPesobrut ? 'Automático: TOTBRUT + TOTNETO' : '—'
                        }
                        disabled={isAutoPesobrut}
                        className="h-8"
                      />
                    </label>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="animate-in gap-0 fade-in-0 p-0 duration-300">
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

          <div className="flex flex-wrap gap-2.5">
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
          </div>

          {canGenerate && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
              Listo para exportar.
            </p>
          )}

          {genError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertTriangle className="size-4" />
              {genError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
