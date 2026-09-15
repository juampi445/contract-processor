import type { Metadata } from 'next';
import RetencionesUploader from '@/components/RetencionesUploader';

export const metadata: Metadata = {
  title: 'Retenciones',
};

export default function RetencionesPage() {
  return <RetencionesUploader />;
}
