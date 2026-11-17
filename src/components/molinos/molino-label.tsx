'use client';

import Link from 'next/link';
import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCuit } from '@/lib/molinos/molinos';
import { useIdentificarMolino } from './identificar-molino-dialog';

/**
 * A mill where a row shows it: its name, or the honest "sin identificar" mark.
 * Inside an `IdentificarMolinoProvider` the mark opens the identify dialog
 * right there; outside one it links to the Molinos section. The user never
 * has to reason about a CUIT: the question is "de quién es este comprobante".
 */
export function MolinoLabel({
  nombre,
  cuit,
  molinosHref,
}: {
  nombre: string | null;
  cuit: string;
  /** `/[company]/molinos`, the fallback when no dialog is mounted. */
  molinosHref: string;
}) {
  const identificar = useIdentificarMolino();
  if (nombre) return <span>{nombre}</span>;

  const badgeClass =
    'gap-1 border-warning/40 text-warning [a]:hover:bg-warning/10 [button]:hover:bg-warning/10 [button]:cursor-pointer';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground tabular-nums">{formatCuit(cuit)}</span>
      {identificar ? (
        <Badge
          variant="outline"
          className={badgeClass}
          render={
            <button
              type="button"
              onClick={() => identificar(cuit)}
              title="Identificar este molino ahora"
            />
          }
        >
          <Tag />
          sin identificar
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className={badgeClass}
          render={<Link href={molinosHref} title="Identificar este molino en Molinos" />}
        >
          <Tag />
          sin identificar
        </Badge>
      )}
    </span>
  );
}
