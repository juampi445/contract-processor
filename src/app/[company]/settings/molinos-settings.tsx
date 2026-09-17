'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Tag, Trash2, Wheat, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmPopover } from '@/components/confirm-popover';
import { IdentificarMolinoDialog } from '@/components/identificar-molino-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  eliminarMolino,
  formatCuit,
  quitarCuit,
  renombrarMolino,
  type CuitSinIdentificar,
  type MolinoConCuits,
} from '@/lib/retenciones/emisores';
import { formatIsoDay } from '@/lib/retenciones/dashboard';
import { createClient } from '@/lib/supabase/client';

/**
 * Naming mills: the management hub. The identify flow itself lives in
 * `IdentificarMolinoDialog`, shared with the PDF preview, so both places
 * behave the same. The user's mental model is "this certificate came from
 * somebody — who?", never "map a CUIT to a row".
 */

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'No se pudo guardar. Probá de nuevo.';
}

/** One mill of the catalog: rename inline, drop a CUIT, delete the mill. */
function MolinoItem({ molino }: { molino: MolinoConCuits }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState(false);
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
          {molino.cuits.length === 0 && (
            <span className="text-xs text-muted-foreground">Sin comprobantes asociados.</span>
          )}
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

export function MolinosSettings({
  pendientes,
  molinos,
}: {
  pendientes: CuitSinIdentificar[];
  molinos: MolinoConCuits[];
}) {
  const router = useRouter();
  const [identificando, setIdentificando] = useState<CuitSinIdentificar | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="molinos-pendientes" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="molinos-pendientes" className="text-sm font-medium text-foreground">
            Comprobantes sin identificar
          </h3>
          {pendientes.length > 0 && (
            <Badge variant="outline" className="border-warning/40 text-warning">
              <Tag />
              {pendientes.length}
            </Badge>
          )}
        </div>

        {pendientes.length === 0 ? (
          <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            Todos los comprobantes procesados tienen molino. Cuando aparezca uno
            nuevo, va a estar acá para que digas de quién es.
          </p>
        ) : (
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
                    {p.sugerido && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        ¿{p.sugerido}?
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.certificados} comprobante{p.certificados === 1 ? '' : 's'}
                    {p.ultimaFecha ? ` · último el ${formatIsoDay(p.ultimaFecha)}` : ''}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => setIdentificando(p)}>
                  <Plus />
                  Identificar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="molinos-lista" className="flex flex-col gap-3">
        <h3 id="molinos-lista" className="text-sm font-medium text-foreground">
          Molinos cargados
        </h3>
        {molinos.length === 0 ? (
          <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            Todavía no hay molinos. Se crean al identificar el primer comprobante.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {molinos.map((m) => (
              <MolinoItem key={m.id} molino={m} />
            ))}
          </ul>
        )}
      </section>

      <IdentificarMolinoDialog
        pendiente={identificando}
        onClose={() => setIdentificando(null)}
        onIdentified={() => router.refresh()}
      />
    </div>
  );
}
