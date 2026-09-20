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

  if (!name || !email || !whatsapp) {
    return NextResponse.json(
      { error: 'name, email and whatsapp are required' },
      { status: 400 }
    );
  }

  const card = safeCard(body.payment);
  if (!card) {
    return NextResponse.json(
      { error: 'valid card details are required' },
      { status: 400 }
    );
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (order.status !== 'created' && order.status !== 'submitted') {
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
      card_brand: card.brand,
      card_last4: card.last4,
      card_exp_month: card.expMonth,
      card_exp_year: card.expYear,
      card_name: card.name || null,
      reference,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select('reference')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reference: data.reference, status: 'submitted' });
}
