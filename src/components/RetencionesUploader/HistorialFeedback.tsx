'use client';

import Link from 'next/link';
import { AlertTriangle, Check, History, Loader2, Lock, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDdMm, type ExistingExport } from '@/lib/retenciones/historial';
import type { RegistroBloqueado } from '@/lib/retenciones/requeridos';

/**
 * Shared feedback for the two flows that produce the XML: the PDF batch and
 * the "ya tengo un Excel" panel. Both export the same file to BIT, so both
 * warn about a re-export, both block on the same missing fields and both
 * report the same way on the histórico.
 */

/**
 * Outcome of writing the exported batch to the histórico. Never blocks the
 * download: the XML is already on disk by the time any of this is known.
 */
export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; saved: number; updated: number; skipped: number }
  | { status: 'error'; message: string };

/**
 * The double-load net. Non-blocking by design: both buttons lead somewhere and
 * "Exportar igual" is the primary one — the user came here to export, we are
 * only making sure they know what they are about to re-send to BIT.
 */
export function DuplicateWarning({
  duplicates,
  onCancel,
  onConfirm,
}: {
  duplicates: ExistingExport[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const many = duplicates.length > 1;
  return (
    <Card
      className="w-full animate-in gap-0 border-warning/40 bg-warning/5 p-4 fade-in-0 duration-200"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {many
              ? `${duplicates.length} liquidaciones ya fueron exportadas`
              : 'Esta liquidación ya fue exportada'}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {duplicates.slice(0, 6).map((d) => (
              <li key={d.liquidacion} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{d.liquidacion}</span>
                {' — última exportación el '}
                {formatDdMm(d.lastExportedAt)}
                {d.exportCount > 1 ? ` (${d.exportCount} veces)` : ''}
              </li>
            ))}
            {duplicates.length > 6 && (
              <li className="text-xs text-muted-foreground">
                y {duplicates.length - 6} más…
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Reexportar{many ? 'las' : 'la'} podría duplicar{many ? 'las' : 'la'} en BIT.
            En el histórico no se duplica: la fila se actualiza.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onConfirm}>
              Exportar igual
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Why the XML cannot be generated yet. `label(index)` names the row the way
 * this flow knows it ("fila 3 de la vista previa", "fila 7 del Excel").
 */
export function BlockedNotice({
  bloqueados,
  label,
}: {
  bloqueados: RegistroBloqueado[];
  label: (index: number) => string;
}) {
  if (bloqueados.length === 0) return null;
  const shown = bloqueados.slice(0, 6);
  return (
    <div
      className="flex w-full items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      role="alert"
    >
      <Lock className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          El XML está bloqueado: BIT rechazaría la importación.
        </p>
        <ul className="mt-1 space-y-0.5 text-xs">
          {shown.map((b) => (
            <li key={b.index}>
              <span className="font-medium">{label(b.index)}:</span> {b.errores.join(' · ')}
            </li>
          ))}
          {bloqueados.length > shown.length && (
            <li>y {bloqueados.length - shown.length} más…</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/**
 * The mill's name where the row shows it, or the honest "sin identificar"
 * tag linking to where it can be named. The user never has to reason about a
 * CUIT: the question is "de quién es este comprobante".
 */
export function EmisorLabel({
  nombre,
  cuit,
  settingsHref,
}: {
  nombre: string | null;
  cuit: string;
  settingsHref: string;
}) {
  if (nombre) return <span>{nombre}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground tabular-nums">{cuit}</span>
      <Badge
        variant="outline"
        className="gap-1 border-warning/40 text-warning [a]:hover:bg-warning/10"
        render={<Link href={settingsHref} title="Identificar este molino en Configuración" />}
      >
        <Tag />
        sin identificar
      </Badge>
    </span>
  );
}

/** "Guardado en el histórico ✓" — the save is automatic, but never silent. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" />
        Guardando en el histórico…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="flex items-start gap-1.5 text-sm text-warning" role="status">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          El XML se descargó, pero no pudimos guardarlo en el histórico.{' '}
          {state.message}
        </span>
      </p>
    );
  }

  const { saved, updated, skipped } = state;
  return (
    <p className="flex items-start gap-1.5 text-sm text-success" role="status">
      {saved > 0 ? (
        <Check className="mt-0.5 size-4 shrink-0" />
      ) : (
        <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={saved > 0 ? undefined : 'text-muted-foreground'}>
        {saved > 0
          ? `Guardado en el histórico ✓ ${saved} retencion${saved === 1 ? '' : 'es'}`
          : 'No se guardó nada en el histórico'}
        {updated > 0 &&
          ` · ${updated} actualizada${updated === 1 ? '' : 's'} (ya estaba${updated === 1 ? '' : 'n'})`}
        {skipped > 0 && (
          <span className="text-muted-foreground">
            {' · '}
            {skipped} con importe dudoso (no es el 5% de la base){' '}
            {skipped === 1 ? 'quedó' : 'quedaron'} sin guardar
          </span>
        )}
      </span>
    </p>
  );
}
