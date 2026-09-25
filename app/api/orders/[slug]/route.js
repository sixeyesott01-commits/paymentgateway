// Public: display info for a payment link (no admin token).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  const { data } = await supabase
    .from('orders')
    .select('slug, service_name, amount_usd, currency, status')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ order: data });
}

// Public: customer leaves a "Contact us" WhatsApp number after payment.
export async function PATCH(req, { params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const whatsapp = (body.whatsapp || '').toString().trim().slice(0, 40);
  if (whatsapp.replace(/\D/g, '').length < 6) {
    return NextResponse.json({ error: 'a valid whatsapp number is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('orders')
    .update({ customer_whatsapp: whatsapp })
    .eq('slug', slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
