-- =====================================================================
--  Ordering Store — Supabase schema
--  Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
--  Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  image_url text,
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  image_url text,
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists subcategories_category_idx on public.subcategories(category_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text not null default '',
  image_url text,
  price numeric(12,2) not null default 0 check (price >= 0),
  mode text not null default 'order' check (mode in ('order','preorder','unavailable')),
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_subcategory_idx on public.products(subcategory_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  first_name text not null,
  last_name text not null,
  phone text not null,
  address text not null,
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'new' check (status in ('new','confirmed','delivered','cancelled')),
  client_ip text,
  created_at timestamptz not null default now()
);
create index if not exists orders_phone_idx on public.orders(phone);
create index if not exists orders_created_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  position int not null default 0,
  product_name text not null,          -- snapshot at order time
  product_description text not null default '',
  product_image text,
  mode text not null,                  -- 'order' or 'preorder' at order time
  unit_price numeric(12,2) not null,   -- snapshot, read from DB (never from browser)
  quantity int not null check (quantity between 1 and 999),
  line_total numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.rate_limits (
  id bigserial primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_lookup_idx on public.rate_limits(action, key, created_at);
create index if not exists rate_limits_created_idx on public.rate_limits(created_at);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.normalize_phone(p text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.client_ip() returns text
language plpgsql stable set search_path = public as $$
declare h json; ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  ip := coalesce(
    nullif(h->>'cf-connecting-ip', ''),
    nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''),
    nullif(h->>'x-real-ip', ''),
    'unknown');
  return ip;
end $$;

-- 8 random chars from an unambiguous alphabet (no I, L, O, 0, 1) → "K7Q2-M9XA"
create or replace function public.gen_order_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  code text := '';
  i int;
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4);
end $$;

-- ---------------------------------------------------------------------
-- place_order: the ONLY way the public can create orders.
-- Prices and totals are recalculated here from the database.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_first_name text, p_last_name text, p_phone text, p_address text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_first text := trim(coalesce(p_first_name, ''));
  v_last  text := trim(coalesce(p_last_name, ''));
  v_addr  text := trim(coalesce(p_address, ''));
  v_phone text := public.normalize_phone(p_phone);
  v_ip    text := public.client_ip();
  v_fee   numeric(12,2);
  v_sub   numeric(12,2) := 0;
  v_order uuid;
  v_code  text;
  v_item  jsonb;
  v_pos   bigint;
  v_pid   text;
  v_qtxt  text;
  v_qty   int;
  v_prod  public.products%rowtype;
begin
  if v_first = '' or v_last = '' or v_addr = '' or v_phone = '' then
    raise exception 'Please fill in all required fields.';
  end if;
  if length(v_first) > 60 or length(v_last) > 60 or length(v_addr) > 500 then
    raise exception 'One of the fields is too long.';
  end if;
  if length(v_phone) < 7 or length(v_phone) > 15 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty or too large.';
  end if;

  -- anti-spam: max 10 orders per hour per connection
  if (select count(*) from public.rate_limits
      where action = 'order' and key = v_ip and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many orders from this connection. Please try again later.';
  end if;
  delete from public.rate_limits where created_at < now() - interval '1 day';
  insert into public.rate_limits(key, action) values (v_ip, 'order');

  select greatest(0, coalesce(
           case when (data->>'delivery_fee') ~ '^[0-9]+(\.[0-9]+)?$'
                then (data->>'delivery_fee')::numeric end, 0))
    into v_fee from public.settings where id = 1;
  v_fee := coalesce(v_fee, 0);

  loop
    v_code := public.gen_order_code();
    exit when not exists (select 1 from public.orders where order_code = v_code);
  end loop;

  insert into public.orders(order_code, first_name, last_name, phone, address, delivery_fee, client_ip)
  values (v_code, v_first, v_last, v_phone, v_addr, v_fee, v_ip)
  returning id into v_order;

  for v_item, v_pos in select value, ordinality from jsonb_array_elements(p_items) with ordinality loop
    v_pid  := v_item->>'product_id';
    v_qtxt := v_item->>'quantity';
    if v_pid is null or v_pid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product in cart.';
    end if;
    if v_qtxt is null or v_qtxt !~ '^[0-9]{1,3}$' then
      raise exception 'Invalid quantity.';
    end if;
    v_qty := v_qtxt::int;
    if v_qty < 1 or v_qty > 999 then raise exception 'Invalid quantity.'; end if;

    select * into v_prod from public.products where id = v_pid::uuid and visible;
    if not found then
      raise exception 'A product in your cart is no longer available. Please review your cart.';
    end if;
    if v_prod.mode = 'unavailable' then
      raise exception '"%" is currently unavailable. Please remove it from your cart.', v_prod.name;
    end if;

    insert into public.order_items(order_id, product_id, position, product_name, product_description,
                                   product_image, mode, unit_price, quantity, line_total)
    values (v_order, v_prod.id, v_pos, v_prod.name, v_prod.description, v_prod.image_url,
            v_prod.mode, v_prod.price, v_qty, v_prod.price * v_qty);
    v_sub := v_sub + v_prod.price * v_qty;
  end loop;

  update public.orders set subtotal = v_sub, total = v_sub + v_fee where id = v_order;

  return jsonb_build_object('order_code', v_code, 'subtotal', v_sub,
                            'delivery_fee', v_fee, 'total', v_sub + v_fee);
end $$;

-- ---------------------------------------------------------------------
-- lookup_order: requires phone AND order code. Rate-limited.
-- Returns one order only; never reveals whether a phone exists.
-- ---------------------------------------------------------------------
create or replace function public.lookup_order(p_phone text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ip    text := public.client_ip();
  v_phone text := public.normalize_phone(p_phone);
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_o     public.orders%rowtype;
begin
  if (select count(*) from public.rate_limits where action = 'lookup_fail'
        and key = 'ip:' || v_ip and created_at > now() - interval '15 minutes') >= 5
     or (select count(*) from public.rate_limits where action = 'lookup_fail'
        and key = 'phone:' || v_phone and created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  if length(v_code) = 8 then
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
  end if;

  select * into v_o from public.orders where phone = v_phone and order_code = v_code;
  if not found then
    insert into public.rate_limits(key, action)
    values ('ip:' || v_ip, 'lookup_fail'), ('phone:' || v_phone, 'lookup_fail');
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'order_code', v_o.order_code, 'first_name', v_o.first_name, 'last_name', v_o.last_name,
      'phone', v_o.phone, 'address', v_o.address, 'status', v_o.status,
      'subtotal', v_o.subtotal, 'delivery_fee', v_o.delivery_fee, 'total', v_o.total,
      'created_at', v_o.created_at),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', i.position, 'product_name', i.product_name,
               'product_description', i.product_description, 'mode', i.mode,
               'unit_price', i.unit_price, 'quantity', i.quantity, 'line_total', i.line_total)
             order by i.position)
      from public.order_items i where i.order_id = v_o.id), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------
revoke execute on function public.gen_order_code() from public, anon, authenticated;
revoke execute on function public.client_ip() from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.lookup_order(text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admins        enable row level security;
alter table public.settings      enable row level security;
alter table public.categories    enable row level security;
alter table public.subcategories enable row level security;
alter table public.products      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.rate_limits   enable row level security;
-- admins and rate_limits: no policies at all = nobody can read/write them via the API.

-- settings
drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings admin update" on public.settings;
create policy "settings admin update" on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- catalog tables: public sees visible rows; admin sees and manages everything
do $$
declare t text;
begin
  foreach t in array array['categories','subcategories','products'] loop
    execute format('drop policy if exists "%1$s read" on public.%1$I', t);
    execute format('create policy "%1$s read" on public.%1$I for select to anon, authenticated using (visible or public.is_admin())', t);
    execute format('drop policy if exists "%1$s admin insert" on public.%1$I', t);
    execute format('create policy "%1$s admin insert" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s admin update" on public.%1$I', t);
    execute format('create policy "%1$s admin update" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s admin delete" on public.%1$I', t);
    execute format('create policy "%1$s admin delete" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- orders & order_items: admin only. Public creates orders ONLY via place_order().
do $$
declare t text;
begin
  foreach t in array array['orders','order_items'] loop
    execute format('drop policy if exists "%1$s admin read" on public.%1$I', t);
    execute format('create policy "%1$s admin read" on public.%1$I for select to authenticated using (public.is_admin())', t);
    execute format('drop policy if exists "%1$s admin update" on public.%1$I', t);
    execute format('create policy "%1$s admin update" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s admin delete" on public.%1$I', t);
    execute format('create policy "%1$s admin delete" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Image storage (public read, admin-only write, 5 MB, jpg/png/webp)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "images admin insert" on storage.objects;
create policy "images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "images admin update" on storage.objects;
create policy "images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_admin()) with check (bucket_id = 'images' and public.is_admin());
drop policy if exists "images admin delete" on storage.objects;
create policy "images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_admin());

-- =====================================================================
--  LAST STEP (run separately AFTER creating your admin user in
--  Authentication → Users). Replace the email, then run:
--
--  insert into public.admins (user_id)
--  select id from auth.users where email = 'you@example.com'
--  on conflict do nothing;
-- =====================================================================
