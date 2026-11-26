alter table public.orders
  add column if not exists fulfillment_method text not null default 'delivery'
    check (fulfillment_method in ('delivery', 'pickup')),
  add column if not exists delivery_distance_band text
    check (
      delivery_distance_band is null
      or delivery_distance_band in ('up_to_5_km', '5_to_10_km', '10_to_20_km', 'over_20_km')
    );
