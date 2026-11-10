-- لوحة مبيعات بنك الرياض — نسخ احتياطي تلقائي + مزامنة فورية بين الأجهزة
-- شغّل هذا الملف مرة واحدة من: Supabase → SQL Editor → Run

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

-- مساحة عمل مشتركة للفريق (المفتاح anon عام بطبيعته مع سياسات واضحة)
drop policy if exists "shared_all_orders" on public.sales_orders;
create policy "shared_all_orders"
  on public.sales_orders
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "shared_all_history" on public.sales_history;
create policy "shared_all_history"
  on public.sales_history
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "shared_all_meta" on public.sales_meta;
create policy "shared_all_meta"
  on public.sales_meta
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Realtime: أي جهاز يستقبل التغيير فور حدوثه
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
