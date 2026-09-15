'use client';

import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useCompany } from '@/components/company-provider';
import { migrateLegacyPresets } from '@/lib/descargas/legacyPresets';
import { createClient } from '@/lib/supabase/client';

/** Runs the one-time localStorage to database preset import on any company page. */
export function LegacyPresetsMigration() {
  const { id: companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    migrateLegacyPresets(supabase, companyId)
      .then((count) => {
        if (cancelled || count === 0) return;
        toast.success(
          count === 1
            ? 'Importamos 1 preset de Descargas guardado en este navegador.'
            : `Importamos ${count} presets de Descargas guardados en este navegador.`,
          { description: 'Ahora los comparte toda la empresa.' },
        );
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('No pudimos importar los presets guardados en este navegador.', {
          description: 'Lo volvemos a intentar la próxima vez que entres.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, companyId]);

  return null;
}
