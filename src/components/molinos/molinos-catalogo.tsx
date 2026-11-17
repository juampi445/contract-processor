'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Tag, Trash2, Wheat, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmPopover } from '@/components/confirm-popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  asociarCuitAMolino,
  crearMolino,
  eliminarMolino,
  formatCuit,
  quitarCuit,
  renombrarMolino,
  type CuitVisto,
  type MolinoConCuits,
} from '@/lib/molinos/molinos';
import { createClient } from '@/lib/supabase/client';
import { useIdentificarMolino } from './identificar-molino-dialog';

/**
 * Administration of the mill catalog: this IS the pre-load. A cooperative can
 * type its mills and their CUITs here before processing a single certificate,
 * and later name whatever turned up unknown. The identify flow itself is the
 * shared dialog (`IdentificarMolinoProvider`), the same one the PDF preview
 * and the dashboard open.
 */

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'No se pudo guardar. Probá de nuevo.';
}

/** `'2026-08-14'` → `'14/08/2026'`. */
function formatFecha(isoDay: string): string {
  const m = isoDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDay;
}

/** "Nuevo molino": a name, nothing else. CUITs are added on the row below. */
function CrearMolinoForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [nombre, setNombre] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const molino = await crearMolino(supabase, nombre);
      toast.success(`Molino "${molino.nombre}" creado.`, {
        description: 'Agregale los CUITs con los que retiene.',
      });
      setNombre('');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="molino-nuevo-nombre">Nuevo molino</FieldLabel>
        <div className="flex max-w-md gap-2">
          <Input
            id="molino-nuevo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del molino"
            maxLength={100}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            className="h-9"
          />
          <Button type="submit" disabled={pending || nombre.trim().length < 2} className="h-9">
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Crear
          </Button>
        </div>
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>
            Cargá los molinos con los que trabajás y sus CUITs, y los comprobantes salen
            con nombre desde el primer PDF.
          </FieldDescription>
        )}
      </Field>
    </form>
  );
}

/** Inline "agregar CUIT" for one mill. */
function AgregarCuitForm({ molino, onDone }: { molino: MolinoConCuits; onDone: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [cuit, setCuit] = useState('');
  const [pending, setPending] = useState(false);
  const digits = cuit.replace(/\D/g, '');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await asociarCuitAMolino(supabase, digits, molino.id);
      toast.success(`${formatCuit(digits)} ahora es de ${molino.nombre}.`);
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="inline-flex items-center gap-1.5">
      <Input
        value={cuit}
        onChange={(e) => setCuit(e.target.value)}
        placeholder="CUIT (11 dígitos)"
        inputMode="numeric"
        autoFocus
        aria-label={`CUIT para ${molino.nombre}`}
        className="h-7 w-40 text-xs"
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
      />
      <Button type="submit" size="sm" className="h-7" disabled={pending || digits.length !== 11}>
        {pending ? <Loader2 className="animate-spin" /> : 'Agregar'}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onDone} disabled={pending}>
        Cancelar
      </Button>
    </form>
  );
}

/** One mill of the catalog: rename inline, add or drop a CUIT, delete the mill. */
function MolinoItem({ molino }: { molino: MolinoConCuits }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState(false);
  const [addingCuit, setAddingCuit] = useState(false);
  const [nombre, setNombre] = useState(molino.nombre);
  const [pending, setPending] = useState(false);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = nombre.trim();
    if (trimmed === molino.nombre) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      await renombrarMolino(supabase, molino.id, trimmed);
      toast.success('Nombre actualizado.');
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function removeCuit(cuit: string): Promise<boolean> {
    try {
      await quitarCuit(supabase, cuit);
      toast.success(`${formatCuit(cuit)} vuelve a quedar sin identificar.`);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function remove(): Promise<boolean> {
    try {
      await eliminarMolino(supabase, molino.id);
      toast.success(`Molino "${molino.nombre}" eliminado.`);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Wheat className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={rename} className="flex max-w-sm gap-2">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              minLength={2}
              maxLength={100}
              className="h-8"
              aria-label="Nombre del molino"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setNombre(molino.nombre);
                  setEditing(false);
                }
              }}
            />
            <Button type="submit" size="sm" disabled={pending || nombre.trim().length < 2}>
              {pending ? <Loader2 className="animate-spin" /> : 'Guardar'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setNombre(molino.nombre);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="truncate">{molino.nombre}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-6 text-muted-foreground"
              aria-label={`Renombrar ${molino.nombre}`}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {molino.cuits.map((cuit) => (
            <span
              key={cuit}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-0.5 pl-2 text-xs text-foreground tabular-nums"
            >
              {formatCuit(cuit)}
              <ConfirmPopover
                title={`¿Quitar ${formatCuit(cuit)} de ${molino.nombre}?`}
                description="Los comprobantes con ese CUIT vuelven a mostrarse como sin identificar."
                confirmLabel="Quitar"
                onConfirm={() => removeCuit(cuit)}
                trigger={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-5 text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar ${formatCuit(cuit)}`}
                  >
                    <X className="size-3" />
                  </Button>
                }
              />
            </span>
          ))}
          {addingCuit ? (
            <AgregarCuitForm molino={molino} onDone={() => setAddingCuit(false)} />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              onClick={() => setAddingCuit(true)}
            >
              <Plus className="size-3" />
              {molino.cuits.length === 0 ? 'Agregar CUIT' : 'Otro CUIT'}
            </Button>
          )}
        </div>
      </div>

      <ConfirmPopover
        title={`¿Eliminar ${molino.nombre}?`}
        description="Se borra del catálogo con sus CUITs. El histórico no se toca: esos comprobantes pasan a sin identificar."
        confirmLabel="Eliminar"
        onConfirm={remove}
        trigger={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Eliminar ${molino.nombre}`}
          >
            <Trash2 />
          </Button>
        }
      />
    </li>
  );
}

/** The catalog: create, rename, add/remove CUITs, delete. */
export function MolinosCatalogo({ molinos }: { molinos: MolinoConCuits[] }) {
  return (
    <div className="flex flex-col gap-6">
      <CrearMolinoForm />

      {molinos.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
          Todavía no hay molinos. Creá el primero arriba, o identificá un comprobante
          cuando aparezca sin nombre.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {molinos.map((m) => (
            <MolinoItem key={m.id} molino={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * CUITs seen on processed documents that the catalog does not know. Must be
 * rendered inside an `IdentificarMolinoProvider`.
 */
export function MolinosSinIdentificar({ pendientes }: { pendientes: CuitVisto[] }) {
  const identificar = useIdentificarMolino();

  if (pendientes.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
        Todos los comprobantes procesados tienen molino. Cuando aparezca uno nuevo, va a
        estar acá para que digas de quién es.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Comprobantes cuyo agente de retención todavía no tiene nombre.
        </p>
        <Badge variant="outline" className="border-warning/40 text-warning">
          <Tag />
          {pendientes.length}
        </Badge>
      </div>
      <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {pendientes.map((p) => (
          <li
            key={p.cuit}
            className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
              <Tag className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground tabular-nums">
                CUIT {formatCuit(p.cuit)}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.vistos} comprobante{p.vistos === 1 ? '' : 's'}
                {p.ultimaFecha ? ` · último el ${formatFecha(p.ultimaFecha)}` : ''}
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => identificar?.(p.cuit)}>
              <Plus />
              Identificar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
