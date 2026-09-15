import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/** Reachable without a session. Everything else redirects to /login. */
const PUBLIC_PATHS = ['/login', '/signup', '/auth'];
/** Pointless once signed in. */
const GUEST_ONLY_PATHS = ['/login', '/signup'];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and does the
 * optimistic signed-in / signed-out redirects. This is NOT the authorization
 * layer: layouts re-check the session and RLS enforces data access.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run right after creating the client: it validates and refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && !matches(pathname, PUBLIC_PATHS)) {
    const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectTo(`/login${next}`);
  }

  if (signedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo('/');
  }

  return response;
}
