create or replace function public.clear_store_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_store_admin() then
    raise exception 'Admin access required.';
  end if;

  lock table public.orders in access exclusive mode;
  delete from public.orders;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function public.clear_store_orders() from public;
grant execute on function public.clear_store_orders() to authenticated;
