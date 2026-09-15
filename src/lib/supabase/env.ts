function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisá .env.local.`);
  }
  return value;
}

// Referenced literally so Next inlines them into the browser bundle.
export const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL',
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
);
