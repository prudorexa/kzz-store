create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('Boys', 'Girls', 'Baby')),
  price_ksh integer not null check (price_ksh >= 0),
  sizes text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  image_path text,
  emoji text,
  tone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin'))
);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  access_token uuid not null default gen_random_uuid() unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  county text not null,
  town text not null,
  delivery_address text not null,
  total_ksh integer not null check (total_ksh > 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  mpesa_checkout_request_id text unique,
  mpesa_receipt_number text,
  mpesa_result_code integer,
  mpesa_result_description text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price_ksh integer not null check (unit_price_ksh >= 0)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.products enable row level security;
alter table public.user_roles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
  on public.products for select
  using (active = true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists "Users can view their own role" on public.user_roles;
create policy "Users can view their own role"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
  on public.orders for select to authenticated
  using (public.is_store_admin());

drop policy if exists "Admins can view order items" on public.order_items;
create policy "Admins can view order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and public.is_store_admin()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Product images are public" on storage.objects;
create policy "Product images are public"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_store_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_store_admin())
  with check (bucket_id = 'product-images' and public.is_store_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_store_admin());

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
    update public.orders
    set payment_status = 'failed',
        mpesa_result_code = p_result_code,
        mpesa_result_description = p_result_description
    where id = v_order.id;
    return false;
  end if;

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

  update public.orders
  set payment_status = 'paid',
      mpesa_receipt_number = p_receipt_number,
      mpesa_result_code = p_result_code,
      mpesa_result_description = p_result_description
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.complete_mpesa_order(text, integer, text, integer, text) from public;
grant execute on function public.complete_mpesa_order(text, integer, text, integer, text) to service_role;
