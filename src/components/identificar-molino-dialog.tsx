'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  asociarCuitAMolino,
  crearMolinoConCuit,
  formatCuit,
  loadMolinos,
  type CuitAIdentificar,
  type EmisorIdentity,
  type MolinoConCuits,
} from '@/lib/retenciones/emisores';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * "¿De quién es este comprobante?" — THE identify flow, used from Configuración
 * and inline from the PDF preview. Two answers:
 *
 *  - "Es un molino que ya tengo": pick one of the catalog → the CUIT is linked
 *    to it (N CUITs → 1 molino).
 *  - "Es un molino nuevo": type a name, prefilled with the suggestion from
 *    `issuers.ts` when the CUIT has rules in code (one click to confirm).
 *
 * The catalog is loaded when the dialog opens, so both callers always see the
 * current list without having to fetch it themselves. The user never has to
 * reason about a CUIT: the copy talks about comprobantes and molinos.
 */

type Modo = 'existente' | 'nuevo';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'No se pudo guardar. Probá de nuevo.';
}

export function IdentificarMolinoDialog({
  pendiente,
  onClose,
  onIdentified,
}: {
  /** The certificate being identified; `null` keeps the dialog closed. */
  pendiente: CuitAIdentificar | null;
  onClose: () => void;
  /** Called after the catalog was written, with what the CUIT now resolves to. */
  onIdentified?: (cuit: string, identity: EmisorIdentity) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const open = pendiente !== null;

  const [molinos, setMolinos] = useState<MolinoConCuits[] | null>(null);
  const [modo, setModo] = useState<Modo>('nuevo');
  const [molinoId, setMolinoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh catalog every time it opens, and a clean form for this certificate.
  useEffect(() => {
    if (!pendiente) return;
    let cancelled = false;
    setMolinos(null);
    setError(null);
    setNombre(pendiente.sugerido ?? '');
    setModo('nuevo');
    loadMolinos(supabase)
      .then((list) => {
        if (cancelled) return;
        setMolinos(list);
        setMolinoId(list[0]?.id ?? '');
        // Default to "ya tengo" only when there is something to pick and no
        // suggestion makes "nuevo" the obvious one-click answer.
        if (list.length > 0 && !pendiente.sugerido) setModo('existente');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMolinos([]);
          setError(errorMessage(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pendiente, supabase]);

  const hasMolinos = (molinos?.length ?? 0) > 0;
  const loading = open && molinos === null;
  const items = (molinos ?? []).map((m) => ({ value: m.id, label: m.nombre }));
  const nombreOk = nombre.trim().length >= 2;
  const canSubmit =
    !pending && !loading && (modo === 'existente' ? molinoId !== '' : nombreOk);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendiente || !canSubmit) return;
    setPending(true);
    setError(null);
    try {
      let identity: EmisorIdentity;
      if (modo === 'existente') {
        await asociarCuitAMolino(supabase, pendiente.cuit, molinoId);
        const molino = molinos?.find((m) => m.id === molinoId);
        identity = { molinoId, nombre: molino?.nombre ?? '' };
        toast.success(`Listo: ese comprobante es de ${identity.nombre || 'ese molino'}.`);
      } else {
        const molino = await crearMolinoConCuit(supabase, nombre, pendiente.cuit);
        identity = { molinoId: molino.id, nombre: molino.nombre };
        toast.success(`Molino "${molino.nombre}" creado e identificado.`);
      }
      onIdentified?.(pendiente.cuit, identity);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>¿De quién es este comprobante?</DialogTitle>
            <DialogDescription>
              {pendiente && (
                <>
                  El agente de retención figura con el CUIT{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCuit(pendiente.cuit)}
                  </span>
                  . Decinos qué molino es y lo usamos para este y los próximos
                  comprobantes con ese CUIT.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={modo}
            onValueChange={(value) => setModo(value as Modo)}
            className="gap-2"
            aria-label="Cómo identificarlo"
          >
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors',
                modo === 'existente' && 'border-primary/40 bg-primary/5',
                !hasMolinos && !loading && 'cursor-not-allowed opacity-60',
              )}
            >
              <RadioGroupItem
                value="existente"
                disabled={!hasMolinos || loading}
                className="mt-0.5"
              />
              <span className="grid min-w-0 flex-1 gap-2">
                <span className="text-sm font-medium text-foreground">
                  Es un molino que ya tengo
                </span>
                <span className="text-xs text-muted-foreground">
                  {loading
                    ? 'Cargando molinos…'
                    : hasMolinos
                      ? 'El mismo molino puede retener desde más de un CUIT.'
                      : 'Todavía no cargaste ningún molino.'}
                </span>
                {modo === 'existente' && hasMolinos && (
                  <Select
                    items={items}
                    value={molinoId}
                    onValueChange={(v) => setMolinoId(v ?? '')}
                  >
                    <SelectTrigger aria-label="Molino" className="h-9 w-full">
                      <SelectValue placeholder="Elegí el molino" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} sideOffset={6}>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </span>
            </label>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors',
                modo === 'nuevo' && 'border-primary/40 bg-primary/5',
              )}
            >
              <RadioGroupItem value="nuevo" className="mt-0.5" />
              <span className="grid min-w-0 flex-1 gap-2">
                <span className="text-sm font-medium text-foreground">Es un molino nuevo</span>
                {modo === 'nuevo' && (
                  <Field>
                    <Input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre del molino"
                      autoFocus
                      maxLength={100}
                      className="h-9"
                      aria-label="Nombre del molino"
                    />
                    {pendiente?.sugerido && nombre === pendiente.sugerido && (
                      <FieldDescription className="text-xs">
                        Nombre sugerido por las reglas de lectura. Podés cambiarlo.
                      </FieldDescription>
                    )}
                  </Field>
                )}
              </span>
            </label>
          </RadioGroup>

          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Identificar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
