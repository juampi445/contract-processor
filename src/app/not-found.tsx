import Link from 'next/link';
import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <AuthShell>
      <AuthHeading
        title="No encontramos esta página"
        description="La dirección no existe o no tenés acceso a esta empresa."
      />
      <Button size="lg" render={<Link href="/" />} nativeButton={false}>
        Ir al inicio
      </Button>
    </AuthShell>
  );
}
