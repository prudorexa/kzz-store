alter table public.products
  add column if not exists colors text[] not null default '{}';

alter table public.orders
  add column if not exists payment_method text not null default 'mpesa'
    check (payment_method in ('mpesa', 'cash_on_delivery'));

alter table public.order_items
  add column if not exists color text not null default '';

drop policy if exists "Admins can update order fulfillment" on public.orders;
create policy "Admins can update order fulfillment"
  on public.orders for update to authenticated
  using (
    public.is_store_admin()
    and (payment_status = 'paid' or payment_method = 'cash_on_delivery')
  )
  with check (
    public.is_store_admin()
    and (payment_status = 'paid' or payment_method = 'cash_on_delivery')
  );

drop policy if exists "Admins can mark cash orders paid" on public.orders;
create policy "Admins can mark cash orders paid"
  on public.orders for update to authenticated
  using (
    public.is_store_admin()
    and payment_method = 'cash_on_delivery'
    and payment_status = 'pending'
  )
  with check (
    public.is_store_admin()
    and payment_method = 'cash_on_delivery'
    and payment_status = 'paid'
  );

revoke update on public.orders from authenticated;
revoke update (fulfillment_status) on public.orders from authenticated;
grant update (fulfillment_status, payment_status) on public.orders to authenticated;

create or replace function public.create_cash_on_delivery_order(
  p_order_id uuid,
  p_order_number text,
  p_access_token uuid,
  p_customer_name text,
  p_email text,
  p_phone text,
  p_county text,
  p_town text,
  p_delivery_address text,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_stock record;
  v_available_stock integer;
  v_total integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'Order must contain at least one item.';
  end if;

  for v_product in
    select p.*
    from public.products p
    join (
      select distinct item.product_id
      from jsonb_to_recordset(p_items) as item(product_id uuid, size text, color text, quantity integer)
    ) requested on requested.product_id = p.id
    order by p.id
    for update of p
  loop
    null;
  end loop;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(product_id uuid, size text, color text, quantity integer)
  loop
    select * into v_product from public.products where id = v_item.product_id;
    if not found or not v_product.active then
      raise exception 'A product in your cart is no longer available.';
    end if;
    if v_item.quantity is null or v_item.quantity < 1
      or v_item.size is null or not (v_item.size = any(v_product.sizes)) then
      raise exception 'A selected size or quantity is no longer valid.';
    end if;
    if coalesce(array_length(v_product.colors, 1), 0) > 0 then
      if coalesce(v_item.color, '') = '' or not (v_item.color = any(v_product.colors)) then
        raise exception 'A selected colour is no longer available.';
      end if;
    elsif coalesce(v_item.color, '') <> '' then
      raise exception 'A selected colour is no longer available.';
    end if;
    v_total := v_total + v_product.price_ksh * v_item.quantity;
  end loop;

  for v_stock in
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, size text, color text, quantity integer)
    group by item.product_id
    order by item.product_id
  loop
    select stock into v_available_stock from public.products where id = v_stock.product_id;
    if not found or v_available_stock < v_stock.quantity then
      raise exception 'There is not enough stock to fulfil this order.';
    end if;
  end loop;

  if v_total < 1 then
    raise exception 'The order total is invalid.';
  end if;

  insert into public.orders (
    id, order_number, access_token, customer_name, email, phone,
    county, town, delivery_address, total_ksh, payment_method,
    payment_status, fulfillment_status
  ) values (
    p_order_id, p_order_number, p_access_token, p_customer_name, p_email, p_phone,
    p_county, p_town, p_delivery_address, v_total, 'cash_on_delivery',
    'pending', 'processing'
  );

  insert into public.order_items (order_id, product_id, product_name, size, color, quantity, unit_price_ksh)
  select p_order_id, p.id, p.name, item.size, coalesce(item.color, ''), item.quantity, p.price_ksh
  from jsonb_to_recordset(p_items) as item(product_id uuid, size text, color text, quantity integer)
  join public.products p on p.id = item.product_id;

  update public.products p
  set stock = p.stock - requested.quantity,
      updated_at = now()
  from (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, size text, color text, quantity integer)
    group by item.product_id
  ) requested
  where p.id = requested.product_id;

  return v_total;
end;
$$;

revoke all on function public.create_cash_on_delivery_order(
  uuid, text, uuid, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.create_cash_on_delivery_order(
  uuid, text, uuid, text, text, text, text, text, text, jsonb
) to service_role;
