// Admin: change an order's status.
//   { action: 'paid' }   -> confirm payment received (activate the service)
//   { action: 'cancel' } -> void the link
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { checkAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = (body.action || '').toString();

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const pending = ['submitted', 'processing'];

  let update;
  if (action === 'paid' || action === 'confirm') {
    if (!pending.includes(order.status)) {
      return NextResponse.json(
        { error: `only a processing order can be confirmed (status: ${order.status})` },
        { status: 409 }
      );
    }
    update = { status: 'paid', paid_at: new Date().toISOString() };
  } else if (action === 'fail') {
    if (!pending.includes(order.status)) {
      return NextResponse.json(
        { error: `only a processing order can be failed (status: ${order.status})` },
        { status: 409 }
      );
    }
    update = { status: 'failed' };
  } else if (action === 'cancel') {
    if (!['created', 'submitted', 'processing'].includes(order.status)) {
      return NextResponse.json({ error: `cannot cancel (status: ${order.status})` }, { status: 409 });
    }
    update = { status: 'canceled' };
  } else {
    return NextResponse.json({ error: 'action must be "confirm", "fail" or "cancel"' }, { status: 400 });
  }

  const { error } = await supabase.from('orders').update(update).eq('id', order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: update.status });
}
