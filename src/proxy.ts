import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next internals and static files (images, Excel templates, pdf.js worker).
    '/((?!_next/static|_next/image|favicon.ico|templates/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xlsx|mjs|js|map)$).*)',
  ],
};
