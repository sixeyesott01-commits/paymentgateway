# Payment Gateway (manual / offline)

Next.js + Supabase. An admin creates a payment link for an amount + service, sends it to a
customer. The customer opens the link, confirms their details, and gets a reference. You
collect the money out-of-band (WhatsApp / bank transfer / UPI, etc.), then mark the order
**paid** in the admin panel and activate the service.

> **No card data is collected or stored anywhere.** There is no card form. This avoids PCI
> scope entirely. If you later want to charge cards online automatically, add Stripe Elements
> — do **not** add a raw card form.

## Flow

1. Admin opens `/admin`, enters amount + service name → gets a link like
   `https://yourdomain.com/pay/XhjdfDoijedfoDHpoohadhef`.
2. Customer opens the link, fills name / email / WhatsApp, clicks **Place order**.
3. Order becomes **submitted** (pending verification) with a reference like `NM-XXXX`. The
   customer is prompted to pay you via WhatsApp and quote the reference.
4. You confirm the money arrived, click **Mark paid** in `/admin`, and activate the service.

## Statuses

`created` → link made · `submitted` → customer sent details, awaiting payment · `paid` →
you confirmed payment · `canceled` → link voided.

## Setup

1. Create a Supabase project.
2. In Supabase → SQL editor, paste and run `db/schema.sql`.
3. Configure env:

```bash
cp .env.example .env      # fill in the values below
npm install
npm run dev
```

| var | what |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key. **Server only.** |
| `ADMIN_TOKEN` | long random string; the only thing gating `/admin` |
| `NEXT_PUBLIC_BASE_URL` | e.g. `http://localhost:3000`, used to build links |
| `CURRENCY` | e.g. `USD` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | your WhatsApp number, digits only (e.g. `15550001234`) |

## Integrating into your store / other agency sites

Create a link server-to-server, then redirect the buyer to it:

```js
const res = await fetch('https://yourdomain.com/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,   // secret, server-side only
    'content-type': 'application/json',
  },
  body: JSON.stringify({ amount: 49.99, service_name: 'Pro plan' }),
});
const { link } = await res.json();   // redirect the customer to `link`
```

> ⚠️ `ADMIN_TOKEN` must live only on your servers, never in browser/frontend code.

## Security notes

- The `orders` table has RLS **on with no policies** — browsers can't touch it. All access is
  server-side via the service role key. Keep that key secret.
- `/admin` is protected by a single shared `ADMIN_TOKEN`. Use a long random value, serve over
  HTTPS, and rotate it. For multiple staff, add real user accounts later.
- This is a manual gateway: it records intent and contact details, it does not move money. Do
  the actual collection through a real, licensed payment method.
