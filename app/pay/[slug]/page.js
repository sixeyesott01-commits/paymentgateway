// Customer-facing page for a payment link (offline / manual verification).
import { getSupabaseAdmin } from '@/lib/supabase';
import CheckoutForm from './CheckoutForm';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

export const dynamic = 'force-dynamic';

function Notice({ children }) {
  return (
    <>
      <SiteHeader title="Checkout" sandbox />
      <div className="container"><div className="card center">{children}</div></div>
      <SiteFooter />
    </>
  );
}

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
    return <Notice><h1>Link not found</h1><p className="muted">This payment link is invalid or has expired.</p></Notice>;
  }

  if (order.status === 'paid' || order.status === 'canceled') {
    const msg = {
      paid: 'This payment has already been confirmed. Thank you!',
      canceled: 'This payment link was canceled.',
    };
    return <Notice><p className="muted">{msg[order.status]}</p></Notice>;
  }

  return <CheckoutForm slug={order.slug} currency={order.currency || 'USD'} />;
}
