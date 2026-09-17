# Esquema de la base

La regla es una sola: **el esquema tiene que existir en git, no solo adentro del
proyecto Supabase.** Las filas de datos nunca van al repo — viven en Supabase.

Una "migración" acá es simplemente el SQL de la estructura guardado como
archivo en `migrations/`. **No hace falta la CLI para aplicarla**: se pega
entera en Supabase Studio > SQL Editor y se ejecuta. Lo que importa es que el
archivo quede commiteado.

## Estado

| Migración | Estado |
|---|---|
| `<pendiente>_baseline.sql` | **FALTA** — ver abajo |
| `20260917120000_retenciones.sql` | en el repo; aplicar en el SQL Editor |

El baseline (tablas actuales, schema `private`, funciones y policies) todavía
no está capturado: generarlo requiere credenciales de la base que no están en
el repo. Hasta que exista, el esquema previo a `retenciones` sigue viviendo
solo dentro de Supabase.

## Generar el baseline

Necesita el project ref (Project Settings → General) y la **contraseña de la
base** (Project Settings → Database). Desde la raíz del repo:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db pull            # escribe migrations/<timestamp>_remote_schema.sql
```

**Verificar antes de commitear** que el archivo generado incluya:

- el schema `private` completo y sus funciones (`can`, `is_member`,
  `shares_company`);
- **todas** las policies de RLS, de `public` y de `storage.objects`
  (los logos: `company_logos_read` / `_insert` / `_update` / `_delete`);
- las funciones de `public` (`create_company`, `invite_member`,
  `accept_pending_invitations`, `invitation_by_token`, `is_company_owner`);
- los grants por columna (p. ej. `grant update (logo_path) on public.companies`).

`db pull` suele traer solo `public`. Si falta `private`, capturarlo aparte:

```bash
pg_dump --schema-only -n private -n public "<connection-string>" > supabase/migrations/<timestamp>_baseline.sql
```

Una vez commiteado el baseline, `20260917120000_retenciones.sql` queda encima
de él y el historial arranca completo.

## Agregar una migración nueva

1. Crear `migrations/<timestamp>_<nombre>.sql` (timestamp `YYYYMMDDHHMMSS`).
2. Escribir el SQL de forma idempotente (`if not exists`, `create or replace`,
   `drop policy if exists` antes de `create policy`) para poder reaplicarlo.
3. Aplicarlo en el SQL Editor, y commitear el archivo.
4. Si cambia el esquema de una tabla que usa la app, actualizar a mano
   `src/lib/supabase/database.types.ts` (hoy se mantiene manualmente).
