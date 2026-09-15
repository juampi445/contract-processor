import type { AuthError, PostgrestError } from '@supabase/supabase-js';

const FALLBACK = 'No pudimos completar la operación. Probá de nuevo.';

/** Codes raised by the database functions (`raise exception '<code>'`). */
const DB_MESSAGES: Record<string, string> = {
  slug_taken: 'Esa dirección ya está en uso. Probá con otra.',
  slug_reserved: 'Esa dirección está reservada. Elegí otra.',
  invalid_company:
    'Revisá los datos: el nombre va de 2 a 100 caracteres y la dirección de 3 a 40 (minúsculas, números y guiones).',
  invalid_email: 'El email no es válido.',
  invalid_role: 'El rol elegido no es válido.',
  already_member: 'Esa persona ya es miembro de la empresa.',
  not_allowed: 'No tenés permisos para hacer esto.',
  not_authenticated: 'Tu sesión venció. Ingresá de nuevo.',
  last_owner: 'La empresa necesita al menos un dueño. Asigná otro dueño antes de hacer este cambio.',
};

export function dbErrorMessage(error: Pick<PostgrestError, 'message' | 'code'> | null): string {
  if (!error) return FALLBACK;
  const known = Object.keys(DB_MESSAGES).find((code) => error.message?.includes(code));
  if (known) return DB_MESSAGES[known];
  if (error.code === '23505') return 'Ya existe un registro con ese nombre.';
  if (error.code === '42501') return DB_MESSAGES.not_allowed;
  return FALLBACK;
}

export function authErrorMessage(error: Pick<AuthError, 'code' | 'message'> | null): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'Email o contraseña incorrectos.';
    case 'email_not_confirmed':
      return 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.';
    case 'weak_password':
      return 'La contraseña es débil. Usá al menos 8 caracteres combinando letras y números.';
    case 'email_address_invalid':
      return 'El email no es válido.';
    case 'over_email_send_rate_limit':
      // Project-wide limit on auth emails, not something this user did.
      return 'No pudimos enviar el email: se alcanzó el límite de envíos por hora. Probá de nuevo más tarde.';
    case 'over_request_rate_limit':
      return 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.';
    case 'signup_disabled':
      return 'El registro está deshabilitado en este momento.';
    case 'otp_expired':
      return 'El link venció o ya fue usado. Pedí uno nuevo.';
    default:
      return FALLBACK;
  }
}
