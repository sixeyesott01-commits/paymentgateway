// Public: customer submits their contact details for a payment link.
// No card data is accepted here — this is a manual/offline gateway.
// The order moves to 'submitted' (pending manual verification) and gets a
// support reference the customer can quote when paying via WhatsApp/bank.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { makeReference } from '@/lib/slug';

export const dynamic = 'force-dynamic';

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

  if (!name || !email || !whatsapp) {
    return NextResponse.json(
      { error: 'name, email and whatsapp are required' },
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
