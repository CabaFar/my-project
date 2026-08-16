-- لوحة مبيعات بنك الرياض — Offline-first + Realtime
-- شغّل هذا الملف مرة واحدة من: Supabase → SQL Editor → Run
-- ثم عطّل تأكيد البريد من: Authentication → Providers → Email → Confirm email = OFF

create table if not exists public.sales_orders (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);

create table if not exists public.sales_history (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false
);

create table if not exists public.sales_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null
);

create index if not exists sales_orders_updated_at_idx on public.sales_orders (updated_at desc);
create index if not exists sales_history_updated_at_idx on public.sales_history (updated_at desc);
create index if not exists sales_orders_deleted_idx on public.sales_orders (deleted);

alter table public.sales_orders enable row level security;
alter table public.sales_history enable row level security;
alter table public.sales_meta enable row level security;

drop policy if exists "authenticated_all_orders" on public.sales_orders;
create policy "authenticated_all_orders"
  on public.sales_orders
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_all_history" on public.sales_history;
create policy "authenticated_all_history"
  on public.sales_history
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated_all_meta" on public.sales_meta;
create policy "authenticated_all_meta"
  on public.sales_meta
  for all
  to authenticated
  using (true)
  with check (true);

-- Realtime: أجهزة متعددة تستقبل التحديث فورًا
do $$
begin
  begin
    alter publication supabase_realtime add table public.sales_orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sales_history;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sales_meta;
  exception when duplicate_object then null;
  end;
end $$;
