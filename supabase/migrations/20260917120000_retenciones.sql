-- Histórico de retenciones: la metadata de cada certificado exportado a BIT.
--
-- Se guarda SOLO la metadata extraída. Los PDF, el XLSX y el XML nunca se
-- suben: se procesan y se descargan en el navegador. Esta tabla es el registro
-- de "qué se exportó", no un repositorio de documentos.
--
-- Aplicar: pegar este archivo entero en Supabase Studio > SQL Editor y
-- ejecutar. Es idempotente, se puede correr más de una vez.

create table if not exists public.retenciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- CONCEPTO_RETIVA ('3310-XXXXXXXX'). Es la identidad del certificado para
  -- BIT, y por eso la clave de deduplicación.
  liquidacion text not null,
  -- LIQCORRELDGI, el Nº de certificado. TEXTO: los ceros a la izquierda son
  -- parte del identificador (ver issuers.ts, normalizeLiqCorrelDgi).
  liq_correl_dgi text,
  -- Nombre del molino resuelto por CUIT en issuers.ts. Null cuando el emisor
  -- no está en la tabla de issuers conocidos.
  emisor text,
  cuit_agente text not null,
  fecha_origen date not null,
  -- El monto retenido (IMPSINIVA), exactamente el valor que viajó en el XML.
  importe numeric(18, 2) not null,
  contrato text,
  -- PDF del que salió, para poder rastrear una fila hasta su origen.
  source_filename text,

  -- Quién y cuándo exportó por PRIMERA vez. La reexportación no los pisa.
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  -- Última vez que se generó el XML con esta liquidación, y cuántas veces en
  -- total: es lo que alimenta el aviso de doble carga en BIT.
  last_exported_at timestamptz not null default now(),
  export_count int not null default 1
);

-- Dedup: reexportar la misma liquidación actualiza la fila, no crea otra.
create unique index if not exists retenciones_company_liquidacion_key
  on public.retenciones (company_id, liquidacion);

-- El acceso siempre es "esta empresa, este rango de fechas" (dashboard).
create index if not exists retenciones_company_fecha_idx
  on public.retenciones (company_id, fecha_origen);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Mismo patrón que el resto de las tablas: la capability la resuelve
-- private.can, que hoy es binaria (owner puede todo; member puede todo lo que
-- no empiece con 'admin.'). Como 'retenciones.*' no es 'admin.%', cualquier
-- member lee y escribe el histórico de su empresa. Es el comportamiento
-- buscado por ahora.
--
-- NO hay UPDATE acá a propósito: la única forma de modificar una fila es
-- save_retenciones() abajo, que controla exactamente qué columnas cambian.
-- Así un member no puede reescribir importes ni el created_by con un PATCH
-- directo a PostgREST.

alter table public.retenciones enable row level security;

drop policy if exists "retenciones: members read" on public.retenciones;
drop policy if exists "retenciones: members insert" on public.retenciones;
drop policy if exists "retenciones: members delete" on public.retenciones;

create policy "retenciones: members read" on public.retenciones
  for select using (private.can(company_id, 'retenciones.read'));

create policy "retenciones: members insert" on public.retenciones
  for insert with check (private.can(company_id, 'retenciones.write'));

create policy "retenciones: members delete" on public.retenciones
  for delete using (private.can(company_id, 'retenciones.write'));

revoke all on public.retenciones from authenticated;
grant select, insert, delete on public.retenciones to authenticated;

-- ---------------------------------------------------------------------------
-- save_retenciones: el upsert del lote exportado
-- ---------------------------------------------------------------------------
-- Existe como función y no como .upsert() del cliente por dos motivos que no
-- se pueden resolver del lado del browser:
--
--  1. `export_count = export_count + 1` es una lectura-modificación-escritura.
--     Calculado en el cliente se pierde si dos personas exportan a la vez;
--     acá es atómico.
--  2. Deja el UPDATE fuera del alcance de la clave pública (ver arriba), así
--     la reexportación solo puede tocar las columnas de esta lista.
--
-- SECURITY DEFINER, entonces el permiso se chequea explícitamente con
-- private.can antes de escribir. Es el mismo patrón que is_company_owner().

-- Devuelve `setof public.retenciones` y no `returns table (...)` a proposito:
-- con `returns table` los nombres de salida (liquidacion, export_count,
-- created_at) quedan como variables OUT dentro del cuerpo, y cualquier
-- referencia sin calificar a esas columnas -- el `on conflict (company_id,
-- liquidacion)`, el `export_count = ...` -- se vuelve ambigua (42702).
--
-- El INSERT va envuelto en un CTE por claridad; `return query` acepta el
-- INSERT ... RETURNING de las dos formas.
--
-- El drop va primero porque `create or replace` no puede cambiar el tipo de
-- retorno de una funcion que ya existe (42P13): una version anterior de este
-- archivo la creo con `returns table`.
drop function if exists public.save_retenciones(uuid, jsonb);

create or replace function public.save_retenciones(p_company uuid, p_rows jsonb)
returns setof public.retenciones
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not private.can(p_company, 'retenciones.write') then
    raise exception 'not_allowed';
  end if;

  return query
  with upserted as (
    insert into public.retenciones as r (
      company_id, liquidacion, liq_correl_dgi, emisor, cuit_agente,
      fecha_origen, importe, contrato, source_filename
    )
    -- distinct on: un mismo lote puede traer la liquidacion repetida (el mismo
    -- PDF cargado dos veces). Sin esto, ON CONFLICT falla con "cannot affect
    -- row a second time".
    select distinct on (row_data->>'liquidacion')
      p_company,
      row_data->>'liquidacion',
      nullif(row_data->>'liq_correl_dgi', ''),
      nullif(row_data->>'emisor', ''),
      row_data->>'cuit_agente',
      (row_data->>'fecha_origen')::date,
      (row_data->>'importe')::numeric,
      nullif(row_data->>'contrato', ''),
      nullif(row_data->>'source_filename', '')
    from jsonb_array_elements(p_rows) as row_data
    where coalesce(row_data->>'liquidacion', '') <> ''
    order by row_data->>'liquidacion'
    on conflict (company_id, liquidacion) do update set
      -- Gana lo ultimo: los valores finales de la tabla editable.
      liq_correl_dgi   = excluded.liq_correl_dgi,
      emisor           = excluded.emisor,
      cuit_agente      = excluded.cuit_agente,
      fecha_origen     = excluded.fecha_origen,
      importe          = excluded.importe,
      contrato         = excluded.contrato,
      source_filename  = excluded.source_filename,
      last_exported_at = now(),
      export_count     = r.export_count + 1
      -- created_by y created_at quedan intactos: son de la PRIMERA exportacion.
    returning r.*
  )
  select * from upserted;
end;
$$;

revoke all on function public.save_retenciones(uuid, jsonb) from public;
grant execute on function public.save_retenciones(uuid, jsonb) to authenticated;
