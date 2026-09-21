// Customer-facing page for a payment link (offline / manual verification).
import { getSupabaseAdmin } from '@/lib/supabase';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }) {
  const { slug } = await params;
  const supabase = getSupabaseAdmin();

  let order = null;
  if (supabase) {
    const { data } = await supabase
      .from('orders')
      .select('slug, service_name, amount_usd, currency, status')
      .eq('slug', slug)
      .maybeSingle();
    order = data;
  }

  if (!order) {
    return (
      <div className="container">
        <div className="card center">
          <h1>Link not found</h1>
          <p className="muted">This payment link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (order.status === 'paid' || order.status === 'canceled') {
    const msg = {
      paid: 'This payment has already been confirmed. Thank you!',
      canceled: 'This payment link was canceled.',
    };
    return (
      <div className="container">
        <div className="card center">
          <p className="muted">{msg[order.status]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="brandbar">
          <span className="lock">Secure Checkout</span>
          <span className="powered">Powered by <b>NexaPay</b></span>
        </div>
        <CheckoutForm
          slug={order.slug}
          currency={order.currency}
          whatsapp={process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''}
        />
      </div>
    </div>
  );
}
