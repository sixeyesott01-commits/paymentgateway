// Admin: create a payment link (order) and list orders.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkAdmin } from '@/lib/auth';
import { makeSlug } from '@/lib/slug';
import { parseAmount } from '@/lib/money';

export const dynamic = 'force-dynamic';

// POST /api/orders  { amount, service_name }
export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const amount = parseAmount(body.amount);
  const serviceName = (body.service_name || '').toString().trim();
  const currency = (process.env.CURRENCY || 'USD').toUpperCase();

  if (!amount) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  if (!serviceName) return NextResponse.json({ error: 'service_name is required' }, { status: 400 });

  // Unique slug (retry on rare collision).
  let slug = null;
  for (let i = 0; i < 5; i++) {
    const candidate = makeSlug(24);
    const { data } = await supabase.from('orders').select('id').eq('slug', candidate).maybeSingle();
    if (!data) { slug = candidate; break; }
  }
  if (!slug) return NextResponse.json({ error: 'could not allocate slug' }, { status: 500 });

  const { data, error } = await supabase
    .from('orders')
    .insert({ slug, service_name: serviceName, amount_usd: amount, currency, status: 'created' })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  return NextResponse.json({ order: data, link: `${base}/pay/${data.slug}` }, { status: 201 });
}

// GET /api/orders -> all orders (admin)
export async function GET(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });
  }
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}
