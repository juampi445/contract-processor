'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type { DescargasPreset } from '@/lib/descargas/presets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NONE = '__none__';
const STORAGE_ERROR = 'No se pudo guardar en este navegador (¿modo privado o sin espacio?).';

type Notice = { kind: 'ok' | 'error'; text: string };

interface PresetBarProps {
  presets: DescargasPreset[];
  selectedId: string | null;
  /** The current inputs differ from the selected preset. */
  isDirty: boolean;
  onSelect: (id: string | null) => void;
  /** Each action returns false when the browser refused to store it. */
  onSaveAs: (name: string) => boolean;
  onUpdate: () => boolean;
  onDelete: () => boolean;
}

export default function PresetBar({
  presets,
  selectedId,
  isDirty,
  onSelect,
  onSaveAs,
  onUpdate,
  onDelete,
}: PresetBarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const selected = presets.find((p) => p.id === selectedId) ?? null;
  const trimmedName = name.trim();
  const nameTaken = presets.some(
    (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  useEffect(() => {
    if (notice?.kind !== 'ok') return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const report = (ok: boolean, text: string) =>
    setNotice(ok ? { kind: 'ok', text } : { kind: 'error', text: STORAGE_ERROR });

  const items = [
    { value: NONE, label: 'Sin preset (valores por defecto)' },
    ...presets.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Bookmark className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Guardá el mapeo y los datos del lote como preset para no volver a cargarlos.
            </p>
          ) : (
            <>
              <Select
                items={items}
                value={selectedId ?? NONE}
                onValueChange={(value) =>
                  onSelect(value == null || value === NONE ? null : String(value))
                }
              >
                <SelectTrigger
                  aria-label="Preset"
                  className="w-full min-w-0 bg-background sm:w-64"
                >
                  <SelectValue />
                </SelectTrigger>
                {/* Anchored below the trigger: by default Base UI overlays the
                    selected item on the trigger, so the list jumped around. */}
                <SelectContent
                  alignItemWithTrigger={false}
                  align="start"
                  sideOffset={6}
                  className="max-h-72 min-w-(--anchor-width)"
                >
                  <SelectGroup>
                    <SelectLabel>Presets guardados</SelectLabel>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="py-1.5">
                        <span className="truncate">{p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem value={NONE} className="py-1.5 text-muted-foreground">
                      <RotateCcw className="size-3.5" />
                      Sin preset (valores por defecto)
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selected && isDirty && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  Cambios sin guardar
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {selected && (
            <Button
              type="button"
              size="sm"
              variant={isDirty ? 'default' : 'outline'}
              disabled={!isDirty}
              onClick={() => report(onUpdate(), `«${selected.name}» actualizado.`)}
            >
              <Save />
              Guardar cambios
            </Button>
          )}

          <Popover
            open={saveOpen}
            onOpenChange={(open) => {
              setSaveOpen(open);
              if (open) setName('');
            }}
          >
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant={selected ? 'ghost' : 'outline'} />
              }
            >
              {selected ? 'Guardar como nuevo…' : 'Guardar como preset…'}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-76">
              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!trimmedName) return;
                  report(onSaveAs(trimmedName), `Preset «${trimmedName}» guardado.`);
                  setSaveOpen(false);
                }}
              >
                <PopoverHeader>
                  <PopoverTitle>Guardar preset</PopoverTitle>
                  <PopoverDescription className="text-xs">
                    Incluye el mapeo de columnas, las obligatorias y los datos del lote.
                  </PopoverDescription>
                </PopoverHeader>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Acopio Los Pinos"
                  aria-label="Nombre del preset"
                  className="h-8"
                />
                {trimmedName && nameTaken && (
                  <p className="text-xs text-muted-foreground">
                    Ya existe un preset con ese nombre: se va a reemplazar.
                  </p>
                )}
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSaveOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={!trimmedName}>
                    {nameTaken ? 'Reemplazar' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>

          {selected && (
            <Popover open={deleteOpen} onOpenChange={setDeleteOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar preset ${selected.name}`}
                  />
                }
              >
                <Trash2 />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <PopoverHeader>
                  <PopoverTitle>¿Eliminar «{selected.name}»?</PopoverTitle>
                  <PopoverDescription className="text-xs">
                    Los valores cargados en pantalla no se borran.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const deletedName = selected.name;
                      setDeleteOpen(false);
                      report(onDelete(), `Preset «${deletedName}» eliminado.`);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={
            notice.kind === 'error'
              ? 'flex items-center gap-1.5 text-xs text-destructive'
              : 'flex animate-in items-center gap-1.5 text-xs text-muted-foreground fade-in-0 duration-200'
          }
        >
          {notice.kind === 'error' ? (
            <AlertTriangle className="size-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
          )}
          {notice.text}
        </p>
      )}
    </div>
  );
}
