-- Isolamento per locale_id. Nessuna query elenca altri clienti.
create table if not exists public.eventi_ordine (
  id text primary key,
  locale_id text not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);
create index if not exists eventi_ordine_locale_idx on public.eventi_ordine (locale_id, created_at desc);
alter table public.eventi_ordine enable row level security;
