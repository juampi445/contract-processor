'use client';

import { useState, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return { signOut, pending };
}

export function SignOutButton(props: ComponentProps<typeof Button>) {
  const { signOut, pending } = useSignOut();
  return (
    <Button type="button" variant="ghost" onClick={signOut} disabled={pending} {...props}>
      <LogOut />
      Cerrar sesión
    </Button>
  );
}
