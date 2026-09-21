-- Run this in the Supabase SQL editor (SQL -> New query -> paste -> Run).
--
-- This is an OFFLINE / manual-verification gateway: no card data is collected
-- or stored at all. An order records the amount, what it's for, and the
-- customer's contact details. Money is collected out-of-band (WhatsApp/bank)
-- and an admin marks the order paid.

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,            -- /pay/<slug>
  service_name      text,
  -- Amount is entered by the CUSTOMER on the payment page, so it is null until
  -- they submit. The check still blocks zero/negative values when present.
  amount_usd        numeric(12,2) check (amount_usd is null or amount_usd > 0),
  currency          text not null default 'USD',

  -- created   -> link made, nobody has opened/submitted yet
  -- submitted -> customer sent their details; awaiting manual payment + verify
  -- paid      -> admin confirmed payment received; activate the service
  -- canceled  -> link voided
  status            text not null default 'created',

  customer_name     text,
  customer_email    text,
  customer_whatsapp text,
  customer_country  text,
  customer_address1 text,
  customer_address2 text,
  customer_zip      text,

  -- SAFE card metadata ONLY. No PAN, no CVV — ever. The CHECK constraint makes
  -- it physically impossible to store more than 4 digits in card_last4.
  card_brand        text,
  card_last4        text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_exp_month    int  check (card_exp_month is null or (card_exp_month between 1 and 12)),
  card_exp_year     int,
  card_name         text,

  reference         text,        -- e.g. NM-XXXX, shown to customer for support
  note              text,        -- internal admin note

  created_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  paid_at           timestamptz
);

create index if not exists orders_slug_idx   on public.orders (slug);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- Lock the table: RLS on, and NO policies. The app talks to it only from the
-- server using the service role key, which bypasses RLS. Anon/auth browser
-- clients therefore cannot read or write it directly.
alter table public.orders enable row level security;

-- If the table already existed before these fields were added, run the block
-- below (safe to run repeatedly).
alter table public.orders add column if not exists customer_address1 text;
alter table public.orders add column if not exists customer_address2 text;
alter table public.orders add column if not exists customer_zip      text;

alter table public.orders add column if not exists card_brand     text;
alter table public.orders add column if not exists card_last4     text;
alter table public.orders add column if not exists card_exp_month int;
alter table public.orders add column if not exists card_exp_year  int;
alter table public.orders add column if not exists card_name      text;

-- Enforce last-4-only at the database level (blocks accidentally storing a PAN).
do $$ begin
  alter table public.orders
    add constraint orders_card_last4_chk
    check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then null; end $$;

-- Let the customer set the amount later (make it nullable, drop the old check).
alter table public.orders alter column amount_usd drop not null;
alter table public.orders alter column service_name drop not null;
