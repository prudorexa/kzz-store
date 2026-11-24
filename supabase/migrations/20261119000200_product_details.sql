alter table public.products
  add column if not exists description text,
  add column if not exists care_instructions text,
  add column if not exists size_guide text,
  add column if not exists gallery_paths text[] not null default '{}';
