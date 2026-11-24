alter table public.products
  add column if not exists cost_ksh integer
    check (cost_ksh is null or cost_ksh >= 0);

alter table public.order_items
  add column if not exists unit_cost_ksh integer
    check (unit_cost_ksh is null or unit_cost_ksh >= 0);

create or replace function public.snapshot_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    select cost_ksh into new.unit_cost_ksh
    from public.products
    where id = new.product_id;
  end if;
  return new;
end;
$$;

revoke all on function public.snapshot_order_item_cost() from public;

drop trigger if exists snapshot_order_item_cost on public.order_items;
create trigger snapshot_order_item_cost
  before insert on public.order_items
  for each row execute function public.snapshot_order_item_cost();
