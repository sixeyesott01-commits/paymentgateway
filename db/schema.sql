-- Run this in the Supabase SQL editor (SQL -> New query -> paste -> Run).
--
-- This is an OFFLINE / manual-verification gateway: no card data is collected
-- or stored at all. An order records the amount, what it's for, and the
-- customer's contact details. Money is collected out-of-band (WhatsApp/bank)
-- and an admin marks the order paid.

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,            -- /pay/<slug>
  service_name      text not null,
  amount_usd        numeric(12,2) not null check (amount_usd > 0),
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
