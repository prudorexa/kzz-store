alter table public.orders
  add column if not exists estimated_delivery_date date,
  add column if not exists courier_name text
    check (courier_name is null or char_length(courier_name) <= 120),
  add column if not exists courier_tracking_url text
    check (courier_tracking_url is null or courier_tracking_url ~* '^https://');

revoke update on public.orders from authenticated;
revoke update (fulfillment_status, payment_status) on public.orders from authenticated;
grant update (
  fulfillment_status,
  payment_status,
  estimated_delivery_date,
  courier_name,
  courier_tracking_url
) on public.orders to authenticated;
