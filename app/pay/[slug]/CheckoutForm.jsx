'use client';

import { useState } from 'react';

const COUNTRIES = ['US', 'IN', 'GB', 'CA', 'AU', 'AE', 'SG', 'Other'];

export default function CheckoutForm({ slug, whatsapp }) {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', country: 'US' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { reference }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.whatsapp) {
      setError('Please fill in your name, email and WhatsApp number.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/checkout/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
      setDone({ reference: data.reference });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (done) {
    const waLink = whatsapp
      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
          `Hi, I placed an order. My reference is ${done.reference}. How do I pay?`
        )}`
      : null;
    return (
      <div>
        <div className="msg ok">✅ Order placed — awaiting payment confirmation.</div>
        <p className="muted" style={{ marginTop: 14 }}>
          Your reference: <strong className="mono">{done.reference}</strong>
        </p>
        <p className="muted">
          Send your payment and share this reference with our team. We activate your
          service as soon as the payment is confirmed.
        </p>
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer">
            <button type="button" style={{ background: '#16a34a' }}>
              💬 Pay / send reference on WhatsApp
            </button>
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label>Full name</label>
      <input value={form.name} onChange={set('name')} placeholder="Jane Doe" />

      <label>Email</label>
      <input type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" />

      <label>WhatsApp number</label>
      <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="+1 555 123 4567" />

      <label>Country</label>
      <select value={form.country} onChange={set('country')}>
        {COUNTRIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      {error && <div className="msg err">{error}</div>}

      <button type="submit" disabled={busy}>
        {busy ? 'Placing order…' : 'Place order'}
      </button>

      <p className="secure">
        We use WhatsApp to confirm payment and activate your service. No card details are
        collected on this page.
      </p>
    </form>
  );
}
