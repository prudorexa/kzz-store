alter table public.orders
  add column if not exists stock_reserved boolean not null default false,
  add column if not exists stock_released boolean not null default false;

create or replace function public.reserve_mpesa_order(
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
  v_subtotal integer := 0;
  v_delivery_fee integer := 0;
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
    v_subtotal := v_subtotal + v_product.price_ksh * v_item.quantity;
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

  if v_subtotal >= 5000 then
    v_delivery_fee := 0;
  elsif p_county = 'Nairobi' then
    v_delivery_fee := 250;
  else
    v_delivery_fee := 350;
  end if;
  v_total := v_subtotal + v_delivery_fee;

  insert into public.orders (
    id, order_number, access_token, customer_name, email, phone,
    county, town, delivery_address, total_ksh, payment_method,
    payment_status, fulfillment_status, stock_reserved
  ) values (
    p_order_id, p_order_number, p_access_token, p_customer_name, p_email, p_phone,
    p_county, p_town, p_delivery_address, v_total, 'mpesa',
    'pending', 'awaiting_payment', true
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
  ) requested
  where p.id = requested.product_id;

  return v_total;
end;
$$;

revoke all on function public.reserve_mpesa_order(
  uuid, text, uuid, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.reserve_mpesa_order(
  uuid, text, uuid, text, text, text, text, text, text, jsonb
) to service_role;

create or replace function public.fail_mpesa_order(
  p_checkout_request_id text,
  p_result_code integer,
  p_result_description text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order
  from public.orders
  where mpesa_checkout_request_id = p_checkout_request_id
  for update;

  if not found or v_order.payment_status = 'paid' then
    return false;
  end if;

  if v_order.stock_reserved then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set payment_status = 'failed',
      stock_reserved = false,
      stock_released = true,
      mpesa_result_code = p_result_code,
      mpesa_result_description = p_result_description
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.fail_mpesa_order(text, integer, text) from public;
grant execute on function public.fail_mpesa_order(text, integer, text) to service_role;

create or replace function public.cancel_mpesa_order(
  p_order_id uuid,
  p_result_description text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.payment_status = 'paid' then
    return false;
  end if;

  if v_order.stock_reserved then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set payment_status = 'failed',
      stock_reserved = false,
      stock_released = true,
      mpesa_result_description = p_result_description
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.cancel_mpesa_order(uuid, text) from public;
grant execute on function public.cancel_mpesa_order(uuid, text) to service_role;

create or replace function public.complete_mpesa_order(
  p_checkout_request_id text,
  p_amount integer,
  p_receipt_number text,
  p_result_code integer,
  p_result_description text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_stock integer;
begin
  select * into v_order
  from public.orders
  where mpesa_checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return false;
  end if;

  if v_order.payment_status = 'paid' then
    return true;
  end if;

  if p_result_code <> 0 or p_amount <> v_order.total_ksh then
    perform public.fail_mpesa_order(
      p_checkout_request_id,
      p_result_code,
      p_result_description
    );
    return false;
  end if;

  if not v_order.stock_reserved then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
      order by product_id
    loop
      select stock into v_stock
      from public.products
      where id = v_item.product_id
      for update;

      if not found or v_stock < v_item.quantity then
        update public.orders
        set payment_status = 'failed',
            mpesa_result_code = p_result_code,
            mpesa_result_description = 'Insufficient stock to fulfil order'
        where id = v_order.id;
        return false;
      end if;
    end loop;

    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
      order by product_id
    loop
      update public.products
      set stock = stock - v_item.quantity,
          updated_at = now()
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set payment_status = 'paid',
      stock_reserved = false,
      mpesa_receipt_number = p_receipt_number,
      mpesa_result_code = p_result_code,
      mpesa_result_description = p_result_description
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.complete_mpesa_order(text, integer, text, integer, text) from public;
grant execute on function public.complete_mpesa_order(text, integer, text, integer, text) to service_role;

create or replace function public.cancel_store_order(
  p_order_id uuid,
  p_result_description text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.payment_status = 'failed' then
    return false;
  end if;

  if not v_order.stock_released then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set payment_status = 'failed',
      stock_reserved = false,
      stock_released = true,
      fulfillment_status = 'awaiting_payment',
      mpesa_result_description = p_result_description
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.cancel_store_order(uuid, text) from public;
grant execute on function public.cancel_store_order(uuid, text) to authenticated;
