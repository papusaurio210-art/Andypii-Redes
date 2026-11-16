-- Contador de visitas de la página
create table if not exists public.page_views (
  page text primary key,
  views bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create policy "page views are readable by everyone"
  on public.page_views
  for select
  to anon, authenticated
  using (true);

-- Suma una visita y devuelve el total. Es la única forma de escribir en la tabla.
create or replace function public.increment_view(p_page text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  total bigint;
begin
  insert into public.page_views (page, views)
  values (coalesce(nullif(btrim(p_page), ''), 'home'), 1)
  on conflict (page) do update
    set views = page_views.views + 1,
        updated_at = now()
  returning views into total;

  return total;
end;
$$;

revoke all on function public.increment_view(text) from public;
grant execute on function public.increment_view(text) to anon, authenticated;
