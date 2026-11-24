alter table public.orders
  add column if not exists fulfillment_status text not null default 'awaiting_payment'
    check (fulfillment_status in ('awaiting_payment', 'processing', 'packed', 'dispatched', 'delivered'));

update public.orders
set fulfillment_status = 'processing'
where payment_status = 'paid'
  and fulfillment_status = 'awaiting_payment';

create or replace function public.set_initial_fulfillment_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
    and old.payment_status is distinct from new.payment_status
    and new.fulfillment_status = 'awaiting_payment' then
    new.fulfillment_status = 'processing';
  end if;
  return new;
end;
$$;

drop trigger if exists set_initial_fulfillment_status on public.orders;
create trigger set_initial_fulfillment_status
  before update of payment_status on public.orders
  for each row execute function public.set_initial_fulfillment_status();

drop policy if exists "Admins can update order fulfillment" on public.orders;
create policy "Admins can update order fulfillment"
  on public.orders for update to authenticated
  using (public.is_store_admin() and payment_status = 'paid')
  with check (public.is_store_admin() and payment_status = 'paid');

revoke update on public.orders from authenticated;
revoke update (fulfillment_status) on public.orders from authenticated;
grant update (fulfillment_status) on public.orders to authenticated;
