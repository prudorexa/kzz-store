alter table public.products
  add column if not exists product_group text not null default 'Other';
