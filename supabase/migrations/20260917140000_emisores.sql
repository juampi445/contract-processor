-- Catálogo de emisores: la IDENTIDAD de cada molino (agente de retención).
--
-- Hasta acá el nombre de un molino salía de `issuers.ts`, que mezclaba dos
-- cosas distintas: las reglas para leer el Nº de certificado (que son de
-- código, cambian con el formato del PDF) y el nombre del molino (que es un
-- dato, y lo tiene que poder cargar el usuario cuando aparece un CUIT nuevo).
-- Esta migración se lleva SOLO la identidad a la base. Los patterns y la
-- normalización del certificado siguen en `issuers.ts`.
--
-- Modelo: N CUITs → 1 molino. Un mismo molino retiene desde más de un CUIT
-- (sucursales, razones sociales distintas), y para el histórico y el
-- dashboard es un solo emisor.
--
-- La base arranca VACÍA a propósito: no se siembran los molinos conocidos por
-- código. Mientras un CUIT no esté acá, la app usa el nombre de `issuers.ts`
-- como fallback y, si tampoco está, lo muestra como "sin identificar" para
-- que alguien lo bautice desde Configuración.
--
-- Este archivo ya fue ejecutado en Supabase Studio. Es idempotente: correrlo
-- de nuevo no crea nada dos veces.
--
-- Verificado contra el esquema vivo (PostgREST, 2026-09-17): tablas, columnas,
-- nullabilidad y FKs de molinos / emisor_cuits y las columnas de la vista
-- emisor_por_cuit coinciden. Lo que PostgREST no expone (nombres de las
-- políticas RLS, el unique de molinos.nombre, security_invoker de la vista)
-- no se pudo comparar: si en producción las políticas tienen otro nombre, este
-- archivo las crea de nuevo con estos nombres sin borrar las viejas.

create table if not exists public.molinos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);

create table if not exists public.emisor_cuits (
  -- 11 dígitos, sin guiones. Es el CUITCORREDOR del XML / cuit_agente del
  -- histórico, así que la resolución es un join directo.
  cuit text primary key,
  molino_id uuid not null references public.molinos(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);

create index if not exists emisor_cuits_molino_idx
  on public.emisor_cuits (molino_id);

-- La vista es lo que consulta la app: `cuit → nombre` en una sola lectura.
create or replace view public.emisor_por_cuit
  with (security_invoker = true)
as
  select c.cuit, c.molino_id, m.nombre
  from public.emisor_cuits c
  join public.molinos m on m.id = c.molino_id;

-- ---------------------------------------------------------------------------
-- RLS (MVP)
-- ---------------------------------------------------------------------------
-- El catálogo es GLOBAL, no por empresa: un molino es el mismo molino para
-- todas las empresas que le procesan retenciones. Lectura y escritura para
-- cualquier usuario autenticado. Cuando haga falta afinar (solo owners
-- escriben, o catálogo por empresa) se ajustan estas políticas.

alter table public.molinos enable row level security;
alter table public.emisor_cuits enable row level security;

drop policy if exists "molinos: authenticated read" on public.molinos;
drop policy if exists "molinos: authenticated write" on public.molinos;
drop policy if exists "emisor_cuits: authenticated read" on public.emisor_cuits;
drop policy if exists "emisor_cuits: authenticated write" on public.emisor_cuits;

create policy "molinos: authenticated read" on public.molinos
  for select to authenticated using (true);

create policy "molinos: authenticated write" on public.molinos
  for all to authenticated using (true) with check (true);

create policy "emisor_cuits: authenticated read" on public.emisor_cuits
  for select to authenticated using (true);

create policy "emisor_cuits: authenticated write" on public.emisor_cuits
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.molinos to authenticated;
grant select, insert, update, delete on public.emisor_cuits to authenticated;
grant select on public.emisor_por_cuit to authenticated;
