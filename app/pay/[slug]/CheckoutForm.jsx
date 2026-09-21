'use client';

import { useEffect, useState } from 'react';

const COUNTRIES = ['US', 'IN', 'GB', 'CA', 'AU', 'AE', 'SG', 'Other'];

// ---- local-only card helpers. The full PAN and CVC NEVER leave the browser ----
function luhn(num) {
  if (num.length < 12 || num.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function parseExpiry(raw) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(raw);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  const end = new Date(year, month, 0, 23, 59, 59);
  if (end < new Date()) return null;
  return { month, year };
}

function detectBrand(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^6/.test(num)) return 'Discover';
  return 'Card';
}

function formatCardInput(raw, brand) {
  const max = brand === 'Amex' ? 15 : 16;
  const d = raw.replace(/\D/g, '').slice(0, max);
  const groups = brand === 'Amex' ? [4, 6, 5] : [4, 4, 4, 4];
  const out = [];
  let i = 0;
  for (const g of groups) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + g));
    i += g;
  }
  return out.join(' ');
}

function formatExpiryInput(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : d.slice(0, 2) + '/' + d.slice(2);
}

export default function CheckoutForm({ slug, whatsapp, currency = 'USD' }) {
  const [step, setStep] = useState('info'); // info | payment
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState({
    name: '',
    email: '',
    whatsapp: '',
    country: 'US',
    address1: '',
    address2: '',
    zip: '',
  });
  // Card entry state — used only for local validation + display. Only the last
  // 4 digits (plus brand/expiry/name) are ever sent. `number` and `cvc` here
  // never get put into the request body.
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', holder: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // null -> still filling the form. Otherwise one of:
  //   'processing' (spinner, waiting on the operator), 'paid', 'failed'
  const [result, setResult] = useState(null);

  // While processing, poll the order status until the operator confirms/fails.
  useEffect(() => {
    if (result !== 'processing') return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${slug}`, { cache: 'no-store' });
        const data = await res.json();
        const s = data?.order?.status;
        if (s === 'paid') setResult('paid');
        else if (s === 'failed' || s === 'canceled') setResult('failed');
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [result, slug]);

  const si = (k) => (e) => setInfo((f) => ({ ...f, [k]: e.target.value }));
  const digits = card.number.replace(/\D/g, '');
  const brand = detectBrand(digits);

  function continueToPayment(e) {
    e.preventDefault();
    setError('');
    if (!(Number(amount) > 0)) {
      setError('Please enter the amount to pay.');
      return;
    }
    if (!info.name || !info.email || !info.whatsapp) {
      setError('Please fill in your name, email and WhatsApp number.');
      return;
    }
    setStep('payment');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    const num = card.number.replace(/\D/g, '');
    const exp = parseExpiry(card.exp);
    if (!luhn(num)) return setError('Please enter a valid card number.');
    if (!exp) return setError('Please enter a valid expiry (MM/YY).');
    if (card.cvc.replace(/\D/g, '').length < 3) return setError('Please enter a valid CVC.');
    if (!card.holder.trim()) return setError('Please enter the name on the card.');

    setBusy(true);
    try {
      const res = await fetch(`/api/checkout/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...info,
          amount,
          // SAFE metadata only — never the full number, never the CVC.
          payment: {
            cardBrand: brand,
            last4: num.slice(-4),
            expMonth: exp.month,
            expYear: exp.year,
            nameOnCard: card.holder.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
      setResult('processing');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (result === 'processing') {
    return (
      <div className="result">
        <div className="spinner-lg" />
        <div className="result-title">Processing payment</div>
        <div className="muted">Please wait, do not close or refresh this page…</div>
      </div>
    );
  }

  if (result === 'paid') {
    return (
      <div className="result">
        <div className="result-icon ok">✓</div>
        <div className="result-title">Payment confirmed</div>
        <div className="muted">Your payment was successful. Thank you.</div>
      </div>
    );
  }

  if (result === 'failed') {
    return (
      <div className="result">
        <div className="result-icon bad">✕</div>
        <div className="result-title">Payment failed</div>
        <div className="muted">Your payment could not be completed. Please try again.</div>
      </div>
    );
  }

  const StepBar = (
    <div className="steps">
      <div className={`step ${step === 'info' ? 'active' : ''}`}>
        <span className="dot">1</span> Details
      </div>
      <span className="bar" />
      <div className={`step ${step === 'payment' ? 'active' : ''}`}>
        <span className="dot">2</span> Payment
      </div>
    </div>
  );

  // ---- Step 1: customer details ----
  if (step === 'info') {
    return (
      <form onSubmit={continueToPayment}>
        {StepBar}
        <label>Amount ({currency})</label>
        <input
          type="number"
          step="0.01"
          min="0.5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <label>Full name</label>
        <input value={info.name} onChange={si('name')} placeholder="Jane Doe" />

        <label>Email</label>
        <input type="email" value={info.email} onChange={si('email')} placeholder="you@email.com" />

        <label>WhatsApp number</label>
        <input value={info.whatsapp} onChange={si('whatsapp')} placeholder="+1 555 123 4567" />

        <label>Address line 1</label>
        <input value={info.address1} onChange={si('address1')} placeholder="123 Main St" />

        <label>Address line 2</label>
        <input value={info.address2} onChange={si('address2')} placeholder="Apt, suite (optional)" />

        <div className="row">
          <div>
            <label>ZIP / Postal code</label>
            <input value={info.zip} onChange={si('zip')} placeholder="10001" />
          </div>
          <div>
            <label>Country</label>
            <select value={info.country} onChange={si('country')}>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="msg err">{error}</div>}
        <button type="submit">Continue to payment</button>
      </form>
    );
  }

  // ---- Step 2: card details ----
  return (
    <form onSubmit={submit}>
      {StepBar}
      <label>Card number</label>
      <input
        value={card.number}
        onChange={(e) =>
          setCard({ ...card, number: formatCardInput(e.target.value, detectBrand(e.target.value.replace(/\D/g, ''))) })
        }
        placeholder="1234 5678 9012 3456"
        inputMode="numeric"
        autoComplete="cc-number"
      />

      <div className="row">
        <div>
          <label>Expiry (MM/YY)</label>
          <input
            value={card.exp}
            onChange={(e) => setCard({ ...card, exp: formatExpiryInput(e.target.value) })}
            placeholder="09/28"
            inputMode="numeric"
            autoComplete="cc-exp"
          />
        </div>
        <div>
          <label>CVC</label>
          <input
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="123"
            inputMode="numeric"
            autoComplete="cc-csc"
          />
        </div>
      </div>

      <label>Name on card</label>
      <input value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="Full name" />

      {error && <div className="msg err">{error}</div>}

      <button type="submit" disabled={busy || digits.length < 12}>
        {busy ? 'Placing order…' : `Pay ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0)}`}
      </button>
      <button
        type="button"
        className="ghost"
        style={{ marginTop: 8 }}
        onClick={() => {
          setError('');
          setStep('info');
        }}
      >
        Back to details
      </button>
    </form>
  );
}
