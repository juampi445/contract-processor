import { PageHeader } from '@/components/page-header';
import { Card, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import BaseXlsxToXmlPanel from './BaseXlsxToXmlPanel';
import SourceUploader from './SourceUploader';

export default function DescargasUploader() {
  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Descargas"
        description="Cargá el Excel del acopio o transportista y generá el Excel base o el XML para el ERP."
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 sm:p-6">
        <SourceUploader />

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          <span>¿ya tenés el Excel base?</span>
          <Separator className="flex-1" />
        </div>

        <BaseXlsxToXmlPanel />

        <Card className="bg-muted/30 p-5 text-sm text-muted-foreground">
          <CardTitle className="text-sm text-foreground">Notas</CardTitle>
          <ul className="flex list-disc flex-col gap-1.5 pl-4">
            <li>
              Se genera un bloque <code className="text-foreground">SubTask_INSERT_ENVIODESC_002_001</code> por
              cada fila, dentro de <code className="text-foreground">&lt;CONTENT&gt;&lt;TaskDS&gt;…&lt;/TaskDS&gt;&lt;/CONTENT&gt;</code>.
            </li>
            <li>
              FECING y FECSAL se completan con la columna FECHA (formato ddmmaaaa). HORING/HORSAL quedan en blanco.
            </li>
            <li>
              Las columnas que no forman parte del formato base se completan automáticamente (0 para numéricas,
              espacio en blanco para texto) al generar el XML.
            </li>
            <li>
              Este formato de &quot;pedido de inserción&quot; se armó a partir de un ejemplo de <em>respuesta</em> del
              ERP — no había un ejemplo de pedido disponible. Validalo con una prueba real de importación.
            </li>
          </ul>
        </Card>
      </main>
    </div>
  );
}
