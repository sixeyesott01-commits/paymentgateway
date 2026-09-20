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
