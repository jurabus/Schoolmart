-- =====================================================================
--  SchoolMart migration 002 — marketplace
--  Customer accounts · Business (supplier) accounts · Global search
--
--  Run ONCE in Supabase: SQL Editor → New query → paste → Run.
--  Requires supabase/schema.sql to have been run first. Safe to re-run.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Phone helpers. Login is phone + password: the phone is turned into an
-- internal login e-mail (never shown, never e-mailed).
--   01001234567 / +20 100 123 4567 / 00201001234567 → 201001234567
-- MUST stay identical to mobile/src/core/phone.ts and js/common.js
-- ---------------------------------------------------------------------
create or replace function public.canonical_phone(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when d like '00%' then substr(d, 3)
    when d like '0%' and length(d) = 11 then '20' || substr(d, 2)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

create or replace function public.phone_email(p text) returns text
language sql immutable set search_path = public as $$
  select 'u' || public.canonical_phone(p) || '@schoolmart.pro';
$$;

create or replace function public.phone_from_email(e text) returns text
language sql immutable set search_path = public as $$
  select case when e ~ '^u[0-9]{8,15}@schoolmart\.pro$' then substring(e from 2 for position('@' in e) - 2) end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (length(name) between 1 and 120),
  image_url text,
  description text not null default '' check (length(description) <= 2000),
  address text not null default '' check (length(address) <= 500),
  contact_phone text not null default '' check (length(contact_phone) <= 30),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (length(first_name) between 1 and 60),
  last_name text not null check (length(last_name) between 1 and 60),
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  address text not null check (length(address) between 1 and 500),
  created_at timestamptz not null default now()
);

-- The original store becomes the first supplier; existing products/orders move to it.
insert into public.businesses (id, name, sort_order)
values ('00000000-0000-4000-8000-000000000001', 'SchoolMart', 0)
on conflict (id) do nothing;

alter table public.products add column if not exists business_id uuid references public.businesses(id) on delete cascade;
update public.products set business_id = '00000000-0000-4000-8000-000000000001' where business_id is null;
alter table public.products alter column business_id set not null;
create index if not exists products_business_idx on public.products(business_id);
create index if not exists products_name_trgm_idx on public.products using gin (lower(name) extensions.gin_trgm_ops);

alter table public.orders add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
update public.orders set business_id = '00000000-0000-4000-8000-000000000001' where business_id is null;
create index if not exists orders_business_idx on public.orders(business_id, created_at desc);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
-- No longer stored (privacy): businesses and customers can now read orders.
alter table public.orders drop column if exists client_ip;

-- ---------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------
create or replace function public.is_business_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = bid and owner_user_id = auth.uid() and active);
$$;

create or replace function public.owns_business_text(bid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id::text = bid and owner_user_id = auth.uid() and active);
$$;

create or replace function public.is_customer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.customers where user_id = auth.uid());
$$;

-- Who am I? → {role: guest|admin|business|customer|none, business?, customer?}
create or replace function public.my_account() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.businesses%rowtype; c public.customers%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('role', 'guest'); end if;
  if public.is_admin() then return jsonb_build_object('role', 'admin'); end if;
  select * into b from public.businesses where owner_user_id = auth.uid();
  if found then return jsonb_build_object('role', 'business', 'business', to_jsonb(b) - 'owner_user_id'); end if;
  select * into c from public.customers where user_id = auth.uid();
  if found then return jsonb_build_object('role', 'customer', 'customer', to_jsonb(c)); end if;
  return jsonb_build_object('role', 'none');
end $$;

-- ---------------------------------------------------------------------
-- Customer sign-up: the app calls auth.signUp with metadata
-- {account_type:'customer', phone, first_name, last_name, address}.
-- This trigger validates it and creates the profile in the same transaction.
-- Any other sign-up (e.g. a business login made by the admin) gets no profile
-- and therefore no rights.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); ph text;
begin
  if m->>'account_type' = 'customer' then
    ph := public.canonical_phone(m->>'phone');
    if ph !~ '^[0-9]{8,15}$' then raise exception 'Invalid phone number'; end if;
    if lower(coalesce(new.email, '')) <> public.phone_email(ph) then raise exception 'Phone does not match login'; end if;
    insert into public.customers (user_id, first_name, last_name, phone, address)
    values (new.id, trim(m->>'first_name'), trim(m->>'last_name'), ph, trim(m->>'address'));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their name and address, never their phone or id.
create or replace function public.customers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.phone is distinct from old.phone or new.user_id is distinct from old.user_id
                                or new.created_at is distinct from old.created_at) then
    raise exception 'Phone number cannot be changed';
  end if;
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.address := trim(new.address);
  return new;
end $$;
drop trigger if exists customers_guard on public.customers;
create trigger customers_guard before update on public.customers for each row execute function public.customers_guard();

-- Customer deletes their own account (required by the App Store / Google Play).
-- Past orders are kept for the business's records but unlinked from the account.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.is_admin() then raise exception 'Admin accounts cannot be deleted here'; end if;
  if exists (select 1 from public.businesses where owner_user_id = auth.uid()) then
    raise exception 'Business accounts can only be deleted by the store admin';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- place_order v2: one order = one business. Signed-in customers are linked
-- to their order and their account phone is used.
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
  v_cust  public.customers%rowtype;
  v_cust_id uuid;
  v_biz   uuid;
  v_biz_name text;
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
  if auth.uid() is not null then
    select * into v_cust from public.customers where user_id = auth.uid();
    if found then
      v_cust_id := v_cust.user_id;
      v_phone := v_cust.phone;                       -- orders always carry the account phone
      if v_first = '' then v_first := v_cust.first_name; end if;
      if v_last = '' then v_last := v_cust.last_name; end if;
      if v_addr = '' then v_addr := v_cust.address; end if;
    end if;
  end if;

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

  if (select count(*) from public.rate_limits
      where action = 'order' and key = v_ip and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many orders from this connection. Please try again later.';
  end if;
  delete from public.rate_limits where created_at < now() - interval '1 day';
  insert into public.rate_limits(key, action) values (v_ip, 'order');

  select greatest(0, coalesce(
           case when (data->>'delivery_fee') ~ '^[0-9]+(\.[0-9]+)?$' then (data->>'delivery_fee')::numeric end, 0))
    into v_fee from public.settings where id = 1;
  v_fee := coalesce(v_fee, 0);

  loop
    v_code := public.gen_order_code();
    exit when not exists (select 1 from public.orders where order_code = v_code);
  end loop;

  insert into public.orders(order_code, first_name, last_name, phone, address, delivery_fee, customer_id)
  values (v_code, v_first, v_last, v_phone, v_addr, v_fee, v_cust_id)
  returning id into v_order;

  for v_item, v_pos in select value, ordinality from jsonb_array_elements(p_items) with ordinality loop
    v_pid  := v_item->>'product_id';
    v_qtxt := v_item->>'quantity';
    if v_pid is null or v_pid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product in cart.';
    end if;
    if v_qtxt is null or v_qtxt !~ '^[0-9]{1,3}$' then raise exception 'Invalid quantity.'; end if;
    v_qty := v_qtxt::int;
    if v_qty < 1 or v_qty > 999 then raise exception 'Invalid quantity.'; end if;

    select p.* into v_prod from public.products p
      join public.businesses b on b.id = p.business_id and b.active
      where p.id = v_pid::uuid and p.visible;
    if not found then
      raise exception 'A product in your cart is no longer available. Please review your cart.';
    end if;
    if v_prod.mode = 'unavailable' then
      raise exception '"%" is currently unavailable. Please remove it from your cart.', v_prod.name;
    end if;
    if v_biz is null then
      v_biz := v_prod.business_id;
    elsif v_biz <> v_prod.business_id then
      raise exception 'Your cart has items from more than one supplier. Please order from one supplier at a time.';
    end if;

    insert into public.order_items(order_id, product_id, position, product_name, product_description,
                                   product_image, mode, unit_price, quantity, line_total)
    values (v_order, v_prod.id, v_pos, v_prod.name, v_prod.description, v_prod.image_url,
            v_prod.mode, v_prod.price, v_qty, v_prod.price * v_qty);
    v_sub := v_sub + v_prod.price * v_qty;
  end loop;

  select name into v_biz_name from public.businesses where id = v_biz;
  update public.orders set subtotal = v_sub, total = v_sub + v_fee, business_id = v_biz where id = v_order;

  return jsonb_build_object('order_code', v_code, 'subtotal', v_sub, 'delivery_fee', v_fee,
                            'total', v_sub + v_fee, 'business_id', v_biz, 'business_name', v_biz_name);
end $$;

-- lookup_order v2: same rules, also returns the supplier name.
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
  if length(v_code) = 8 then v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4); end if;

  -- Account orders store the canonical phone; also accept the local format for those.
  select * into v_o from public.orders
   where order_code = v_code and (phone = v_phone or phone = public.canonical_phone(v_phone));
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
      'created_at', v_o.created_at,
      'business_name', (select name from public.businesses where id = v_o.business_id)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', i.position, 'product_name', i.product_name,
               'product_description', i.product_description, 'mode', i.mode,
               'unit_price', i.unit_price, 'quantity', i.quantity, 'line_total', i.line_total)
             order by i.position)
      from public.order_items i where i.order_id = v_o.id), '[]'::jsonb));
end $$;

-- Business changes the status of one of ITS orders (the only order field it may change).
create or replace function public.business_set_order_status(p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('new', 'confirmed', 'delivered', 'cancelled') then raise exception 'Invalid status'; end if;
  update public.orders set status = p_status
   where id = p_order and public.is_business_owner(business_id);
  if not found then raise exception 'Order not found'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Admin tools (website admin panel). Every function checks is_admin().
-- ---------------------------------------------------------------------
create or replace function public.admin_list_businesses() returns table (
  id uuid, name text, image_url text, description text, address text, contact_phone text,
  active boolean, sort_order int, created_at timestamptz, login_phone text,
  product_count bigint, order_count bigint
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  return query
    select b.id, b.name, b.image_url, b.description, b.address, b.contact_phone, b.active, b.sort_order,
           b.created_at, public.phone_from_email(u.email::text),
           (select count(*) from public.products p where p.business_id = b.id),
           (select count(*) from public.orders o where o.business_id = b.id)
      from public.businesses b left join auth.users u on u.id = b.owner_user_id
     order by b.sort_order, b.created_at;
end $$;

-- Step 2 of "create business": the admin page first signs the login up
-- (phone + password), then calls this to turn that login into a business.
-- Also used to give an existing business a (new) login.
create or replace function public.admin_create_business(
  p_login_phone text, p_name text, p_image_url text, p_description text, p_address text,
  p_contact_phone text, p_business_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select id into v_user from auth.users where lower(email) = public.phone_email(p_login_phone);
  if v_user is null then raise exception 'No login exists for this phone number yet'; end if;
  if exists (select 1 from public.admins where user_id = v_user) then raise exception 'That phone belongs to an admin'; end if;
  if exists (select 1 from public.customers where user_id = v_user) then
    raise exception 'That phone number is already registered as a customer account';
  end if;
  if exists (select 1 from public.businesses where owner_user_id = v_user and id is distinct from p_business_id) then
    raise exception 'That phone number is already used by another business';
  end if;

  if p_business_id is null then
    insert into public.businesses (owner_user_id, name, image_url, description, address, contact_phone, sort_order)
    values (v_user, trim(p_name), nullif(trim(coalesce(p_image_url, '')), ''), trim(coalesce(p_description, '')),
            trim(coalesce(p_address, '')), trim(coalesce(p_contact_phone, '')),
            coalesce((select max(sort_order) from public.businesses), 0) + 10)
    returning id into v_id;
  else
    update public.businesses set owner_user_id = v_user where id = p_business_id returning id into v_id;
    if v_id is null then raise exception 'Business not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'Password must be at least 8 characters'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Cannot change an admin password here'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
                        updated_at = now()
   where id = p_user;
  if not found then raise exception 'Account not found'; end if;
end $$;

create or replace function public.admin_business_set_password(p_business uuid, p_password text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select owner_user_id into v_user from public.businesses where id = p_business;
  if v_user is null then raise exception 'This business has no login yet'; end if;
  perform public.admin_set_password(v_user, p_password);
end $$;

create or replace function public.admin_update_customer(
  p_user uuid, p_first_name text, p_last_name text, p_phone text, p_address text
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_phone text := public.canonical_phone(p_phone); v_old text;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if v_phone !~ '^[0-9]{8,15}$' then raise exception 'Invalid phone number'; end if;
  select phone into v_old from public.customers where user_id = p_user;
  if v_old is null then raise exception 'Customer not found'; end if;
  if v_phone <> v_old then
    if exists (select 1 from auth.users where lower(email) = public.phone_email(v_phone) and id <> p_user) then
      raise exception 'That phone number is already used by another account';
    end if;
    update auth.users set email = public.phone_email(v_phone), updated_at = now() where id = p_user;
  end if;
  update public.customers
     set first_name = p_first_name, last_name = p_last_name, phone = v_phone, address = p_address
   where user_id = p_user;
end $$;

create or replace function public.admin_delete_customer(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if not exists (select 1 from public.customers where user_id = p_user) then raise exception 'Customer not found'; end if;
  delete from auth.users where id = p_user;
end $$;

-- Deletes the business, its products and its login. Its past orders are kept (unlinked).
create or replace function public.admin_delete_business(p_business uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select owner_user_id into v_user from public.businesses where id = p_business;
  if not found then raise exception 'Business not found'; end if;
  delete from public.businesses where id = p_business;
  if v_user is not null and not exists (select 1 from public.admins where user_id = v_user) then
    delete from auth.users where id = v_user;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Search: typo-tolerant product search by name (pg_trgm).
-- Ranking: exact → starts with → word starts with → contains → fuzzy match,
-- available items before unavailable, then closeness.
-- ---------------------------------------------------------------------
create index if not exists products_name_prefix_idx on public.products (lower(name) text_pattern_ops);
create index if not exists products_name_trgm_gist_idx on public.products using gist (lower(name) extensions.gist_trgm_ops);

-- Tier 1: name matches what was typed (1–2 letters: starts-with only; 3+: contains).
-- Tier 2: only if tier 1 can't fill the page, typo-tolerant matches via the trigram index.
-- Security definer with explicit filters: returns only visible products of active
-- businesses (the same rule as public browsing), without per-row policy checks.
create or replace function public.search_products(p_q text, p_limit int default 5, p_offset int default 0)
returns table (id uuid, name text, snippet text, image_url text, price numeric, mode text,
               business_id uuid, business_name text)
language plpgsql stable security definer
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.3
as $$
declare
  t    text := lower(trim(regexp_replace(left(coalesce(p_q, ''), 80), '\s+', ' ', 'g')));
  e    text;
  lim  int := least(greatest(coalesce(p_limit, 5), 1), 50);
  off  int := least(greatest(coalesce(p_offset, 0), 0), 1000);
  need int;
  match_sql text;
begin
  if t = '' then return; end if;
  e := replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_');
  need := off + lim;
  match_sql := case when length(t) < 3
    then $m$(lower(p.name) like $2 || '%' or lower(p.name) like '% ' || $2 || '%')$m$
    else $m$lower(p.name) like '%' || $2 || '%'$m$ end;

  -- EXECUTE plans with the real values every time, so the right index is always used.
  return query execute replace($f$
    with a as (
      select p.id, p.name, p.description, p.image_url, p.price, p.mode, p.business_id, b.name as bname,
             row_number() over (order by
               case when lower(p.name) = $1 then 0
                    when lower(p.name) like $2 || '%' then 1
                    when lower(p.name) like '% ' || $2 || '%' then 2 else 3 end,
               (p.mode = 'unavailable'), length(p.name), p.name, p.id) as rn
        from public.products p join public.businesses b on b.id = p.business_id and b.active
       where p.visible and __MATCH__
       order by rn limit $3
    ),
    f as (
      select x.id, x.name, x.description, x.image_url, x.price, x.mode, x.business_id, x.bname,
             100000 + row_number() over (order by x.d, (x.mode = 'unavailable'), x.name, x.id) as rn
        from (
          -- nearest-match index scan: stops as soon as it has enough rows
          select p.id, p.name, p.description, p.image_url, p.price, p.mode, p.business_id, b.name as bname,
                 $1 <<-> lower(p.name) as d
            from public.products p join public.businesses b on b.id = p.business_id and b.active
           where length($1) >= 3 and (select count(*) from a) < $3
             and p.visible and $1 <% lower(p.name) and lower(p.name) not like '%' || $2 || '%'
           order by $1 <<-> lower(p.name)
           limit greatest($3 - (select count(*) from a), 0)
        ) x
    )
    select id, name, left(regexp_replace(description, '\s+', ' ', 'g'), 90), image_url, price, mode, business_id, bname
      from (select * from a union all select * from f) r
     order by rn offset $4 limit $5
  $f$, '__MATCH__', match_sql) using t, e, need, off, lim;
end $$;

-- Categories/subcategories that a business actually sells in (for its store page).
create or replace function public.business_subcategories(p_business uuid)
returns table (category_id uuid, category_title text, category_image text, category_sort int,
               subcategory_id uuid, subcategory_title text, subcategory_image text, subcategory_sort int,
               product_count bigint)
language sql stable security invoker set search_path = public as $$
  select c.id, c.title, c.image_url, c.sort_order, s.id, s.title, s.image_url, s.sort_order, count(p.id)
    from public.products p
    join public.subcategories s on s.id = p.subcategory_id and s.visible
    join public.categories c on c.id = s.category_id and c.visible
   where p.business_id = p_business and p.visible
   group by c.id, s.id
   order by c.sort_order, c.title, s.sort_order, s.title;
$$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.my_account() to anon, authenticated;
grant execute on function public.search_products(text, int, int) to anon, authenticated;
grant execute on function public.business_subcategories(uuid) to anon, authenticated;
grant execute on function public.canonical_phone(text) to anon, authenticated;
grant execute on function public.business_set_order_status(uuid, text) to authenticated;
revoke execute on function public.business_set_order_status(uuid, text) from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_businesses()', 'admin_create_business(text,text,text,text,text,text,uuid)',
    'admin_set_password(uuid,text)', 'admin_business_set_password(uuid,text)',
    'admin_update_customer(uuid,text,text,text,text)', 'admin_delete_customer(uuid)',
    'admin_delete_business(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.customers_guard() from public, anon, authenticated;

-- businesses: everyone may read the public profile columns (not the login link).
revoke all on public.businesses from anon, authenticated;
grant select (id, name, image_url, description, address, contact_phone, active, sort_order, created_at)
  on public.businesses to anon, authenticated;
grant update (name, image_url, description, address, contact_phone, active, sort_order) on public.businesses to authenticated;
grant insert (name, image_url, description, address, contact_phone, active, sort_order) on public.businesses to authenticated;
grant delete on public.businesses to authenticated;

grant select, update on public.customers to authenticated;
grant delete on public.customers to authenticated;

-- products: businesses manage their own
grant insert, update, delete on public.products to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.customers  enable row level security;

drop policy if exists "businesses read" on public.businesses;
create policy "businesses read" on public.businesses for select to anon, authenticated
  using (active or public.is_admin() or owner_user_id = auth.uid());
drop policy if exists "businesses admin insert" on public.businesses;
create policy "businesses admin insert" on public.businesses for insert to authenticated with check (public.is_admin());
drop policy if exists "businesses admin update" on public.businesses;
create policy "businesses admin update" on public.businesses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "businesses admin delete" on public.businesses;
create policy "businesses admin delete" on public.businesses for delete to authenticated using (public.is_admin());

drop policy if exists "customers read" on public.customers;
create policy "customers read" on public.customers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "customers update" on public.customers;
create policy "customers update" on public.customers for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "customers admin delete" on public.customers;
create policy "customers admin delete" on public.customers for delete to authenticated using (public.is_admin());

-- products: public sees visible items of active businesses; owners see/manage all of theirs.
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select to anon, authenticated
  using ((visible and exists (select 1 from public.businesses b where b.id = business_id and b.active))
         or public.is_admin() or public.is_business_owner(business_id));
drop policy if exists "products admin insert" on public.products;
drop policy if exists "products admin update" on public.products;
drop policy if exists "products admin delete" on public.products;
drop policy if exists "products insert" on public.products;
create policy "products insert" on public.products for insert to authenticated
  with check (public.is_admin() or public.is_business_owner(business_id));
drop policy if exists "products update" on public.products;
create policy "products update" on public.products for update to authenticated
  using (public.is_admin() or public.is_business_owner(business_id))
  with check (public.is_admin() or public.is_business_owner(business_id));
drop policy if exists "products delete" on public.products;
create policy "products delete" on public.products for delete to authenticated
  using (public.is_admin() or public.is_business_owner(business_id));

-- orders: admin all; a business its own; a customer their own.
drop policy if exists "orders admin read" on public.orders;
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select to authenticated
  using (public.is_admin() or public.is_business_owner(business_id) or customer_id = auth.uid());

drop policy if exists "order_items admin read" on public.order_items;
drop policy if exists "order_items read" on public.order_items;
create policy "order_items read" on public.order_items for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.orders o where o.id = order_id
       and (public.is_business_owner(o.business_id) or o.customer_id = auth.uid())));

-- storage: businesses upload product photos under images/biz/<their business id>/
drop policy if exists "images business insert" on storage.objects;
create policy "images business insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = 'biz'
              and public.owns_business_text((storage.foldername(name))[2]));
drop policy if exists "images business update" on storage.objects;
create policy "images business update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = 'biz'
         and public.owns_business_text((storage.foldername(name))[2]))
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = 'biz'
              and public.owns_business_text((storage.foldername(name))[2]));
drop policy if exists "images business delete" on storage.objects;
create policy "images business delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = 'biz'
         and public.owns_business_text((storage.foldername(name))[2]));
