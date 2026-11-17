import type { Metadata } from 'next';
import { IdentificarMolinoProvider } from '@/components/molinos/identificar-molino-dialog';
import { MolinosCatalogo, MolinosSinIdentificar } from '@/components/molinos/molinos-catalogo';
import { PageHeader } from '@/components/page-header';
import { SettingsSection } from '@/components/settings-section';
import { getSupabase, requireCompany } from '@/lib/auth/dal';
import { cuitsSinIdentificar, loadMolinoMap, loadMolinos } from '@/lib/molinos/molinos';
import { loadCuitsVistos } from '@/lib/retenciones/historial';

export const metadata: Metadata = { title: 'Molinos' };

/**
 * Master data: who each CUIT is. The catalog is global; the "sin identificar"
 * list is composed here from what THIS company has processed (retenciones
 * today; descargas when it has persistence) minus what the catalog knows.
 * That composition is the only place the two modules meet.
 */
export default async function MolinosPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const [company, supabase] = await Promise.all([requireCompany(slug), getSupabase()]);

  const [molinos, conocidos, vistos] = await Promise.all([
    loadMolinos(supabase),
    loadMolinoMap(supabase),
    loadCuitsVistos(supabase, company.id),
  ]);
  const pendientes = cuitsSinIdentificar(vistos, conocidos);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title="Molinos" description="De quién es cada comprobante." />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:py-10">
        <IdentificarMolinoProvider>
          <SettingsSection
            id="molinos-sin-identificar"
            title="Sin identificar"
            description="Comprobantes procesados cuyo agente de retención no está en el catálogo. Decí de quién son."
          >
            <MolinosSinIdentificar pendientes={pendientes} />
          </SettingsSection>

          <SettingsSection
            id="molinos-catalogo"
            title="Catálogo"
            description="Los molinos con los que trabajás y los CUITs con los que retienen. Podés cargarlos antes de procesar nada."
          >
            <MolinosCatalogo molinos={molinos} />
          </SettingsSection>
        </IdentificarMolinoProvider>
      </main>
    </div>
  );
}
