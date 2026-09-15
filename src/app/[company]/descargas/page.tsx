import type { Metadata } from 'next';
import DescargasUploader from '@/components/DescargasUploader';

export const metadata: Metadata = {
  title: 'Descargas',
};

export default function DescargasPage() {
  return <DescargasUploader />;
}
