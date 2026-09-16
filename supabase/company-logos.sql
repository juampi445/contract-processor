-- Company logos. Idempotente: se puede correr más de una vez sin romper nada.
-- Pegar entero en Supabase Studio > SQL Editor y ejecutar.

-- 1) Dónde se guarda la referencia. Guardamos el PATH dentro del bucket, no la
--    URL completa: si algún día cambia el dominio del proyecto, la data sigue
--    siendo válida.
alter table public.companies
  add column if not exists logo_path text;

-- Si en este proyecto los UPDATE de companies están limitados por columna
-- (grant update (name) ...), esto habilita la nueva. Si no se usan grants por
-- columna, es inofensivo.
grant update (logo_path) on public.companies to authenticated;

-- 2) Helper SECURITY DEFINER. Las policies de storage necesitan mirar
--    memberships, y hacerlo con un select directo dispara las policies de esa
--    tabla (recursión y permisos raros). Con definer se evalúa una sola vez y
--    de forma predecible.
create or replace function public.is_company_owner(p_company uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.memberships
    where company_id = p_company
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

grant execute on function public.is_company_owner(uuid) to authenticated;

-- 3) Bucket público: un logo no es dato sensible y así se sirve por CDN sin
--    firmar URLs, que es lo que permite renderizarlo desde el servidor.
--    2 MB y solo imágenes; el límite lo aplica el storage, no el cliente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4) Policies sobre los objetos. La convención de path es <company_id>/<archivo>,
--    así que el primer segmento identifica de quién es el objeto.
drop policy if exists "company_logos_read"   on storage.objects;
drop policy if exists "company_logos_insert" on storage.objects;
drop policy if exists "company_logos_update" on storage.objects;
drop policy if exists "company_logos_delete" on storage.objects;

create policy "company_logos_read"
on storage.objects for select
using (bucket_id = 'company-logos');

-- El regex evita que un path con carpeta no-uuid haga fallar el cast.
create policy "company_logos_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_company_owner(((storage.foldername(name))[1])::uuid)
);

create policy "company_logos_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_company_owner(((storage.foldername(name))[1])::uuid)
);

create policy "company_logos_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_company_owner(((storage.foldername(name))[1])::uuid)
);
