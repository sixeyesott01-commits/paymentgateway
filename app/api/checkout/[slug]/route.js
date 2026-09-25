// Public: customer submits their contact + SAFE card metadata for a link.
// The order moves to 'submitted' (pending manual verification) and gets a
// support reference the customer can quote when paying via WhatsApp/bank.
//
// SECURITY — DO NOT CHANGE: we accept ONLY brand + last4 + expiry + name.
// The full card number (PAN) and CVC must never reach the server. safeCard()
// rejects anything where last4 is not exactly 4 digits, so a full PAN can't be
// stored even if the client is tampered with. Never add a `cvv`/`number` field.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { makeReference } from '@/lib/slug';
import { parseAmount } from '@/lib/money';

export const dynamic = 'force-dynamic';

function safeCard(p) {
  if (!p || typeof p !== 'object') return null;
  const last4 = String(p.last4 || '').replace(/\D/g, '');
  if (last4.length !== 4) return null; // <-- enforces last-4-only. NEVER widen.
  const brand = String(p.cardBrand || p.brand || 'Card').slice(0, 20);
  const month = Number(p.expMonth);
  const year = Number(p.expYear);
  const name = String(p.nameOnCard || '').slice(0, 120);
  return {
    brand,
    last4,
    expMonth: month >= 1 && month <= 12 ? month : null,
    expYear: year >= 2000 && year <= 2100 ? year : null,
    name,
  };
}

export async function POST(req, { params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = (body.name || '').toString().trim().slice(0, 120);
  const email = (body.email || '').toString().trim().slice(0, 200);
  const whatsapp = (body.whatsapp || '').toString().trim().slice(0, 40);
  const country = (body.country || '').toString().trim().slice(0, 40);
  const address1 = (body.address1 || '').toString().trim().slice(0, 200);
  const address2 = (body.address2 || '').toString().trim().slice(0, 200);
  const zip = (body.zip || '').toString().trim().slice(0, 20);
  const city = (body.city || '').toString().trim().slice(0, 80);
  const stateRegion = (body.state || '').toString().trim().slice(0, 80);
  const phone = (body.phone || '').toString().trim().slice(0, 40);

  // Method detail + promo (purely descriptive; no card data here).
  const paymentLabel = (body.methodLabel || body.paymentLabel || '').toString().trim().slice(0, 120);
  const emiPlan = (body.emiPlan || '').toString().trim().slice(0, 80);
  const promoCode = (body.promoCode || '').toString().trim().slice(0, 40);
  let discount = Number(body.discount);
  discount = Number.isFinite(discount) && discount >= 0 ? Math.round(discount * 100) / 100 : 0;

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: 'name, email and phone are required' },
      { status: 400 }
    );
  }

  const amount = parseAmount(body.amount);
  if (!amount) {
    return NextResponse.json({ error: 'a valid amount is required' }, { status: 400 });
  }

  // Payment method: 'card' requires SAFE card metadata (brand/last4/exp/name).
  // Non-card methods (wallet, paylater) carry NO card data at all — we store
  // only a human label. The strict safeCard() rule above is never relaxed.
  const allowed = ['card', 'upi', 'netbanking', 'wallet', 'emi', 'paylater', 'cod'];
  const method = allowed.includes(String(body.method)) ? String(body.method) : 'card';
  let card;
  if (method === 'card') {
    card = safeCard(body.payment);
    if (!card) {
      return NextResponse.json(
        { error: 'valid card details are required' },
        { status: 400 }
      );
    }
  } else {
    // Non-card methods carry NO card data — only a descriptive label.
    card = { brand: null, last4: null, expMonth: null, expYear: null, name: null };
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!['created', 'submitted', 'failed'].includes(order.status)) {
    return NextResponse.json(
      { error: `this link is no longer available (status: ${order.status})` },
      { status: 409 }
    );
  }

  const reference = order.reference || makeReference();

  const { data, error } = await supabase
    .from('orders')
    .update({
      customer_name: name,
      customer_email: email,
      customer_whatsapp: whatsapp,
      customer_country: country || null,
      customer_address1: address1 || null,
      customer_address2: address2 || null,
      customer_zip: zip || null,
      customer_city: city || null,
      customer_state: stateRegion || null,
      customer_phone: phone || null,
      amount_usd: amount,
      card_brand: card.brand,
      card_last4: card.last4,
      card_exp_month: card.expMonth,
      card_exp_year: card.expYear,
      card_name: card.name || null,
      payment_method: method,
      payment_label: paymentLabel || null,
      emi_plan: emiPlan || null,
      promo_code: promoCode || null,
      discount_amount: discount || null,
      reference,
      status: 'processing',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select('reference')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reference: data.reference, status: 'processing' });
}
