import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { PRODUCT_NAME } from '@/components/brand-mark';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Procesador de constancias de retención y descargas: convierte PDF y Excel a formatos para el ERP, en el navegador.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn('dark font-sans', geist.variable)}>
      <body>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
