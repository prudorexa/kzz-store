alter table public.products
  add column if not exists compare_at_price_ksh integer;

alter table public.products
  drop constraint if exists products_compare_at_price_check;

alter table public.products
  add constraint products_compare_at_price_check
  check (compare_at_price_ksh is null or compare_at_price_ksh > price_ksh);
