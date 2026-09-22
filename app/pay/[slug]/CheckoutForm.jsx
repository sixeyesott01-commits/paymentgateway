'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { acceptedNetworks, wallets as walletsFor, detectBrand, NETWORK_LABEL } from '@/lib/payment-methods';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

const COUNTRIES = ['US', 'IN', 'GB', 'CA', 'AU', 'AE', 'SG', 'Other'];
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Citibank', 'Chase', 'Bank of America', 'Barclays', 'HSBC'];
// Demo promo codes (sandbox). flat = fixed off in order currency; pct = fraction.
const CODES = { SAVE10: { type: 'pct', value: 0.10, kind: 'Promo code' }, WELCOME5: { type: 'flat', value: 5, kind: 'Gift card' } };
const COD_FEE = 0.99;
const BRAND_BADGE = { visa: 'visa', mastercard: 'mc', amex: 'amex', rupay: 'rupay', discover: 'discover', unknown: 'unk' };
const BRAND_TEXT = { visa: 'VISA', mastercard: 'mastercard', amex: 'AMEX', rupay: 'RuPay', discover: 'DISC', unknown: 'CARD' };

function luhn(num) {
  if (num.length < 12 || num.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}
function parseExpiry(raw) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(raw);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (new Date(year, month, 0, 23, 59, 59) < new Date()) return null;
  return { month, year };
}
function fmtCard(raw, brand) {
  const max = brand === 'amex' ? 15 : 16;
  const d = raw.replace(/\D/g, '').slice(0, max);
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
  const out = []; let i = 0;
  for (const g of groups) { if (i >= d.length) break; out.push(d.slice(i, i + g)); i += g; }
  return out.join(' ');
}
function fmtExp(raw) { const d = raw.replace(/\D/g, '').slice(0, 4); return d.length <= 2 ? d : d.slice(0, 2) + '/' + d.slice(2); }
const round2 = (v) => Math.round(v * 100) / 100;

// deterministic-ish faux QR
function QR() {
  const cells = useMemo(() => {
    const n = 25, r = [];
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let on;
      if (finder(x, y)) { const lx = x < 7 ? x : x - (n - 7), ly = y < 7 ? y : y - (n - 7); const ring = Math.max(Math.abs(lx - 3), Math.abs(ly - 3)); on = ring === 3 || ring <= 1; }
      else on = ((x * 7 + y * 13 + x * y) % 5) < 2;
      if (on) r.push(<rect key={x + '-' + y} x={x} y={y} width="1" height="1" />);
    }
    return r;
  }, []);
  return <svg className="qr" viewBox="0 0 25 25" shapeRendering="crispEdges" role="img" aria-label="UPI QR code"><g fill="#0F1111">{cells}</g></svg>;
}

export default function CheckoutForm({ slug, currency = 'USD' }) {
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n) || 0);

  const [view, setView] = useState('checkout');        // checkout | success
  const [detailsDone, setDetailsDone] = useState(false);
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState({ name: '', email: '', whatsapp: '', phone: '', country: 'US', address1: '', address2: '', city: '', state: '', zip: '' });

  const [method, setMethod] = useState(null);
  const [savedCards, setSavedCards] = useState([
    { key: 'card1', brand: 'visa', bank: 'HDFC Bank Visa', last4: '4589', name: 'Card Holder', exp: '09/26', expMonth: 9, expYear: 2026 },
    { key: 'card2', brand: 'mastercard', bank: 'ICICI Bank Mastercard', last4: '2231', name: 'Card Holder', exp: '03/27', expMonth: 3, expYear: 2027 },
  ]);
  const [cvv, setCvv] = useState({});
  const [nc, setNc] = useState({ number: '', exp: '', cvc: '', holder: '' });
  const [upi, setUpi] = useState({ id: '', ok: false, label: '', msg: null });
  const [bank, setBank] = useState('');
  const [walletSel, setWalletSel] = useState('');
  const [emiPlan, setEmiPlan] = useState('');
  const [gift, setGift] = useState(null);
  const [giftInput, setGiftInput] = useState('');
  const [giftErr, setGiftErr] = useState('');
  const [ncErr, setNcErr] = useState('');
  const [payErr, setPayErr] = useState('');

  const [result, setResult] = useState(null);          // null | processing | failed
  const [procStep, setProcStep] = useState(0);
  const [reference, setReference] = useState('');
  const [info_modal, setInfoModal] = useState(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const amt = Number(amount) || 0;
  const networks = acceptedNetworks(info.country);
  const walletList = walletsFor(info.country);

  function toast(msg, type = 'ok') {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  const plans = useMemo(() => {
    const emi = (p, r, n) => (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const m6 = emi(amt, 0.12 / 12, 6), m9 = emi(amt, 0.14 / 12, 9), m12 = emi(amt, 0.14 / 12, 12);
    return [
      { key: 'pl4', name: 'payUnexa Pay Later', tenure: '4 payments', monthly: amt / 4, interest: 0, apr: '0% APR' },
      { key: 'm3', name: 'No-cost EMI', tenure: '3 months', monthly: amt / 3, interest: 0, apr: '0% APR' },
      { key: 'm6', name: 'Standard EMI', tenure: '6 months', monthly: m6, interest: m6 * 6 - amt, apr: '12% p.a.' },
      { key: 'm9', name: 'Standard EMI', tenure: '9 months', monthly: m9, interest: m9 * 9 - amt, apr: '14% p.a.' },
      { key: 'm12', name: 'Standard EMI', tenure: '12 months', monthly: m12, interest: m12 * 12 - amt, apr: '14% p.a.' },
    ];
  }, [amt]);

  const discount = gift ? (gift.type === 'flat' ? Math.min(gift.value, amt) : round2(amt * gift.value)) : 0;
  const codFee = method === 'cod' ? COD_FEE : 0;
  const total = Math.max(0, round2(amt + codFee - discount));

  const isCard = (m) => m && (m === 'card1' || m === 'card2' || m.startsWith('cardNew'));
  function ready() {
    const m = method;
    if (!m) return false;
    if (m === 'card1' || m === 'card2') return (cvv[m] || '').length >= 3;
    if (m.startsWith('cardNew')) return true;
    if (m === 'newcard') return false;
    if (m === 'upi') return upi.ok;
    if (m === 'netbanking') return !!bank;
    if (m === 'wallet') return !!walletSel;
    if (m === 'emi') return !!emiPlan;
    if (m === 'cod') return true;
    return false;
  }

  // poll while processing
  useEffect(() => {
    if (result !== 'processing') return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${slug}`, { cache: 'no-store' });
        const data = await res.json();
        const s = data?.order?.status;
        if (s === 'paid') { setResult(null); setView('success'); }
        else if (s === 'failed' || s === 'canceled') { setResult('failed'); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(id);
  }, [result, slug]);

  useEffect(() => {
    if (result !== 'processing') return;
    setProcStep(0);
    const t1 = setTimeout(() => setProcStep(1), 1500);
    const t2 = setTimeout(() => setProcStep(2), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [result]);

  const si = (k) => (e) => setInfo((f) => ({ ...f, [k]: e.target.value }));

  function saveDetails(e) {
    e.preventDefault();
    setPayErr('');
    if (!(amt > 0)) return toast('Enter the amount to pay', 'error');
    if (!info.name || !info.email || !info.whatsapp) return toast('Fill name, email and WhatsApp', 'error');
    setDetailsDone(true);
    toast('Details saved');
  }

  function applyGift() {
    const code = giftInput.trim().toUpperCase();
    if (!code) return setGiftErr('Please enter a code first.');
    if (gift) return setGiftErr('A code is already applied. Remove it to apply another.');
    const c = CODES[code];
    if (!c) return setGiftErr(`The code “${code}” is not valid. (Try SAVE10)`);
    setGiftErr(''); setGift({ code, ...c }); setGiftInput('');
    toast('Code ' + code + ' applied');
  }

  function addNewCard() {
    const num = nc.number.replace(/\D/g, '');
    const errs = [];
    if (num.length < 15 || !luhn(num)) errs.push('Card number');
    if (!nc.holder.trim()) errs.push('Name on card');
    const exp = parseExpiry(nc.exp);
    if (!exp) errs.push('Expiry (MM/YY)');
    if (nc.cvc.length < 3) errs.push('CVV');
    if (errs.length) { setNcErr('Please check: ' + errs.join(', ')); return; }
    setNcErr('');
    const brand = detectBrand(num), last4 = num.slice(-4);
    const key = 'cardNew' + (savedCards.filter((c) => c.key.startsWith('cardNew')).length + 1);
    const card = { key, brand, bank: NETWORK_LABEL[brand] + ' card', last4, name: nc.holder.trim(), exp: nc.exp, expMonth: exp.month, expYear: exp.year, isNew: true };
    setSavedCards((s) => [card, ...s]);
    setNc({ number: '', exp: '', cvc: '', holder: '' });
    setMethod(key);
    toast('Card added & tokenized by payUnexa Vault');
  }

  function methodLabel() {
    const m = method;
    const c = savedCards.find((x) => x.key === m);
    if (c) return `${NETWORK_LABEL[c.brand] || 'Card'} •••• ${c.last4}`;
    if (m === 'upi') return 'UPI — ' + (upi.label || upi.id);
    if (m === 'netbanking') return 'Net Banking — ' + bank;
    if (m === 'wallet') return 'Wallet — ' + walletSel;
    if (m === 'emi') { const p = plans.find((x) => x.key === emiPlan); return p ? `${p.name} (${p.tenure}) — ${money(p.monthly)}/mo` : 'EMI'; }
    if (m === 'cod') return 'Cash on Delivery';
    return '—';
  }
  function backendMethod() {
    if (isCard(method)) return 'card';
    if (method === 'emi') return 'emi';
    return method;
  }

  async function placeOrder() {
    setPayErr('');
    if (!detailsDone) return toast('Complete your details first', 'error');
    if (!method) return toast('Choose a payment method', 'error');
    if (method === 'newcard') return toast('Add your card details first', 'error');
    if (!ready()) {
      if (method === 'card1' || method === 'card2') return toast('Enter the CVV for your card', 'error');
      if (method === 'upi') return toast('Verify a UPI ID or pick an app', 'error');
      if (method === 'netbanking') return toast('Select your bank', 'error');
      if (method === 'wallet') return toast('Choose a wallet', 'error');
      if (method === 'emi') return toast('Select an EMI / Pay Later plan', 'error');
      return toast('Complete the selected method', 'error');
    }

    const bm = backendMethod();
    const body = {
      name: info.name, email: info.email, whatsapp: info.whatsapp, phone: info.phone,
      country: info.country, address1: info.address1, address2: info.address2,
      city: info.city, state: info.state, zip: info.zip,
      amount: String(total), method: bm,
      methodLabel: methodLabel(),
      promoCode: gift?.code || '', discount,
      emiPlan: bm === 'emi' ? (plans.find((x) => x.key === emiPlan)?.tenure || '') : '',
    };
    if (bm === 'card') {
      const c = savedCards.find((x) => x.key === method);
      body.payment = { cardBrand: NETWORK_LABEL[c.brand] || 'Card', last4: c.last4, expMonth: c.expMonth, expYear: c.expYear, nameOnCard: c.name };
    }

    setResult('processing');
    try {
      const res = await fetch(`/api/checkout/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
      setReference(data.reference || '');
    } catch (e) {
      setResult(null);
      toast(e.message, 'error');
    }
  }

  function downloadInvoice() {
    const L = [
      'payUnexa — PAYMENT RECEIPT', '='.repeat(40),
      'Reference : ' + reference,
      'Date      : ' + new Date().toLocaleString(),
      'Payment   : ' + methodLabel(),
      '', 'BILL TO',
      `${info.name}, ${[info.address1, info.city, info.state, info.zip, info.country].filter(Boolean).join(', ')}`,
      '', 'Amount   : ' + money(amt),
      ...(discount ? ['Discount : -' + money(discount)] : []),
      ...(codFee ? ['COD fee  : ' + money(codFee)] : []),
      'TOTAL    : ' + money(total), '',
      'Thank you for paying with payUnexa.',
    ];
    const url = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = 'payunexa-receipt.txt'; a.click(); URL.revokeObjectURL(url);
    toast('Receipt downloaded');
  }

  const INFO = {
    cvv: { t: 'What is a CVV?', b: 'The Card Verification Value is the 3-digit security code on the back of your card (4 digits on the front for American Express). payUnexa never stores your CVV.' },
    fx: { t: 'About currency', b: `Your card is charged in ${currency}. If your card is in another currency, your bank converts at its prevailing rate plus any conversion charge.` },
  };

  /* ================= SUCCESS SCREEN ================= */
  if (view === 'success') {
    const emailMask = info.email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');
    return (
      <>
        <SiteHeader title="Order confirmed" sandbox />
        <section className="success-screen">
          <div className="succ-card">
            <div className="succ-anim">
              <svg viewBox="0 0 52 52"><circle className="sc" cx="26" cy="26" r="24" /><path className="sp" d="M15 27l7.5 7.5L38 19" /></svg>
            </div>
            <h2>Payment successful, thank you!</h2>
            <p className="succ-sub">Confirmation sent to <b>{emailMask}</b></p>
            <div className="succ-grid">
              <div>
                <div className="sg-lbl">Reference</div>
                <div className="sg-val">{reference || '—'} <button className="linklike" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard?.writeText(reference); toast('Reference copied'); }}>Copy</button></div>
                <div className="sg-lbl">Amount paid</div>
                <div className="sg-val">{money(total)}</div>
                <div className="sg-lbl">Paid using</div>
                <div className="sg-val">{methodLabel()}</div>
              </div>
              <div>
                <div className="sg-lbl">Billed to</div>
                <div className="sg-val">{info.name}</div>
                <div className="sg-lbl">Contact</div>
                <div className="sg-val">{info.email}</div>
              </div>
            </div>
            <div className="succ-actions">
              <button className="btn-primary" onClick={downloadInvoice}>Download receipt</button>
              <button className="btn-secondary" onClick={() => location.reload()}>Done</button>
            </div>
          </div>
        </section>
        <SiteFooter />
      </>
    );
  }

  const stepIdx = !detailsDone ? 0 : !ready() ? 1 : 2;
  const Step = ({ i, label }) => (
    <div className={`step ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}>
      <span className="dot">{i < stepIdx ? '✓' : i + 1}</span><span>{label}</span>
    </div>
  );

  const PayOpt = ({ mkey, ico, title, sub, tags, children }) => (
    <div className={`payopt ${method === mkey ? 'selected' : ''}`} onClick={() => setMethod(mkey)}>
      <div className="opt-head">
        <input type="radio" name="pay" readOnly checked={method === mkey} />
        <span className="opt-ico">{ico}</span>
        <span><span className="opt-title">{title}</span><span className="opt-sub">{sub}</span></span>
        {tags && <span className="opt-tags">{tags}</span>}
        <span className="chev">▾</span>
      </div>
      {children && <div className={`opt-body ${method === mkey ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );

  /* ================= CHECKOUT ================= */
  return (
    <>
      <SiteHeader title="Checkout" sandbox />

      <div className="steps">
        <Step i={0} label="Your details" />
        <div className="sep" />
        <Step i={1} label="Payment method" />
        <div className="sep" />
        <Step i={2} label="Review & pay" />
      </div>

      <div className="grid">
        <div className="col-main">
          {/* ---------- 1. DETAILS ---------- */}
          <div className="card">
            {!detailsDone ? (
              <form onSubmit={saveDetails}>
                <h2><span className="stepnum">1</span> Your details</h2>
                <div className="form-grid" style={{ marginTop: 14 }}>
                  <div className="field span2"><label>Amount to pay ({currency})</label>
                    <input className="ti" type="number" step="0.01" min="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
                  <div className="field"><label>Full name</label><input className="ti" value={info.name} onChange={si('name')} placeholder="Jane Doe" /></div>
                  <div className="field"><label>Email</label><input className="ti" type="email" value={info.email} onChange={si('email')} placeholder="you@email.com" /></div>
                  <div className="field"><label>WhatsApp number</label><input className="ti" value={info.whatsapp} onChange={si('whatsapp')} placeholder="+1 555 123 4567" /></div>
                  <div className="field"><label>Phone (optional)</label><input className="ti" value={info.phone} onChange={si('phone')} placeholder="Alternate phone" /></div>
                  <div className="field span2"><label>Address line 1</label><input className="ti" value={info.address1} onChange={si('address1')} placeholder="123 Main St" /></div>
                  <div className="field span2"><label>Address line 2</label><input className="ti" value={info.address2} onChange={si('address2')} placeholder="Apt, suite (optional)" /></div>
                  <div className="field"><label>City</label><input className="ti" value={info.city} onChange={si('city')} /></div>
                  <div className="field"><label>State / Region</label><input className="ti" value={info.state} onChange={si('state')} /></div>
                  <div className="field"><label>ZIP / Postal code</label><input className="ti" value={info.zip} onChange={si('zip')} placeholder="10001" /></div>
                  <div className="field"><label>Country</label>
                    <select className="ti" value={info.country} onChange={si('country')}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                </div>
                <button className="btn-primary sm" type="submit" style={{ marginTop: 14 }}>Save &amp; continue</button>
              </form>
            ) : (
              <div className="addr-flex">
                <div>
                  <h2 style={{ fontSize: 17 }}><span className="stepnum">✓</span> Your details</h2>
                  <div className="addr-name" style={{ marginTop: 14 }}>{info.name} · {money(amt)}</div>
                  <div className="addr-line">{info.email} · {info.whatsapp}</div>
                  {info.address1 && <div className="addr-ph">{[info.address1, info.address2, info.city, info.state, info.zip, info.country].filter(Boolean).join(', ')}</div>}
                </div>
                <button className="linklike" style={{ fontWeight: 600 }} onClick={() => setDetailsDone(false)}>Change</button>
              </div>
            )}
          </div>

          {/* ---------- 2. PAYMENT METHOD ---------- */}
          <div className="card">
            <div className="addr-flex">
              <h2><span className="stepnum">2</span> Payment method</h2>
              <span className="muted" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#067D62" strokeWidth="2"><path d="M12 3l7 3v5c0 4.6-3 8.1-7 9.2C8 19.1 5 15.6 5 11V6z" /></svg>
                Powered by <b>payUnexa</b>
              </span>
            </div>

            {/* gift / promo */}
            <div className="gift-box">
              <div className="gift-head">Gift card / promo</div>
              <div className="gift-sub">Enter a gift card, voucher or promotional code</div>
              <div className="gift-row">
                <span className="plus">+</span>
                <input className="ti" maxLength={25} placeholder="Enter code (try SAVE10)" value={giftInput}
                  onChange={(e) => setGiftInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyGift(); } }} />
                <button className="btn-secondary" type="button" onClick={applyGift}>Apply</button>
              </div>
              {giftErr && <div className="inline-msg error">{giftErr}</div>}
              {gift && <div className="inline-msg success"><b>{gift.kind} “{gift.code}”</b> applied — {gift.type === 'flat' ? `${money(discount)} off` : `10% off — you saved ${money(discount)}`} <button className="linklike" style={{ marginLeft: 6 }} onClick={() => { setGift(null); setGiftErr(''); }}>Remove</button></div>}
            </div>

            {/* pay-later banner */}
            <div className="pl-banner" role="button" tabIndex={0} onClick={() => setMethod('emi')}>
              <div className="pl-text"><b>{info.name || 'You'}</b>, pay 4 interest-free payments of <b>{money(round2(total / 4))}</b> with <b>payUnexa Pay Later</b>. Subject to eligibility. <span className="pl-link">Learn more</span></div>
              <div className="pl-div" />
              <div className="pl-apr"><b>0% APR</b><span>No interest. Ever.</span></div>
            </div>

            {/* saved + new cards */}
            <div className="pmt-group">
              <div className="pmt-group-title">Credit &amp; debit cards</div>
              <div className="cards-cols"><span /><span /><span /><span>Name on card</span><span>Expires</span><span /></div>
              {savedCards.map((c) => (
                <div key={c.key} className={`payopt saved-card ${method === c.key ? 'selected' : ''}`} onClick={() => setMethod(c.key)}>
                  <input type="radio" name="pay" readOnly checked={method === c.key} />
                  <div><span className={`blogo ${BRAND_BADGE[c.brand]}`}>{BRAND_TEXT[c.brand]}</span></div>
                  <div><div className="c-title">{c.bank}</div><div className="c-sub">•••• {c.last4}{c.isNew ? ' · tokenized' : ''}</div></div>
                  <div className="c-name">{c.name}</div>
                  <div className="c-exp">{c.exp}</div>
                  <div className="c-cvv" onClick={(e) => e.stopPropagation()}>
                    {c.isNew ? <span className="cvv-ok">CVV verified</span> :
                      <input className="ti cvv-input" placeholder="CVV" maxLength={4} inputMode="numeric" value={cvv[c.key] || ''}
                        onChange={(e) => setCvv((v) => ({ ...v, [c.key]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />}
                  </div>
                </div>
              ))}
              <div className={`payopt ${method === 'newcard' ? 'selected' : ''}`} onClick={() => setMethod('newcard')}>
                <div className="opt-head">
                  <input type="radio" name="pay" readOnly checked={method === 'newcard'} />
                  <span className="nc-plus">+</span>
                  <span><span className="opt-title">Add a new card</span><span className="opt-sub">Visa · Mastercard · RuPay · Amex — tokenized &amp; secure</span></span>
                  <span className="chev">▾</span>
                </div>
                <div className={`opt-body ${method === 'newcard' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <div className="net-badges" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {['visa', 'mastercard', 'amex', 'rupay', 'discover'].map((n) => (
                      <span key={n} className={`blogo ${BRAND_BADGE[n]} ${networks.includes(n) ? '' : 'off'}`}>{BRAND_TEXT[n]}</span>
                    ))}
                  </div>
                  <div className="form-grid">
                    <div className="field span2"><label>Card number</label>
                      <div className="num-wrap">
                        <input className="ti" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={nc.number}
                          onChange={(e) => setNc({ ...nc, number: fmtCard(e.target.value, detectBrand(e.target.value.replace(/\D/g, ''))) })} />
                        <span className={`blogo ${BRAND_BADGE[detectBrand(nc.number.replace(/\D/g, ''))]}`}>{BRAND_TEXT[detectBrand(nc.number.replace(/\D/g, ''))]}</span>
                      </div>
                    </div>
                    <div className="field span2"><label>Name on card</label><input className="ti" autoComplete="cc-name" placeholder="Name as printed on card" value={nc.holder} onChange={(e) => setNc({ ...nc, holder: e.target.value })} /></div>
                    <div className="field"><label>Expiry (MM/YY)</label><input className="ti" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={nc.exp} onChange={(e) => setNc({ ...nc, exp: fmtExp(e.target.value) })} /></div>
                    <div className="field"><label>CVV <button className="linklike" type="button" style={{ fontSize: 11.5 }} onClick={() => setInfoModal(INFO.cvv)}>What&apos;s this?</button></label>
                      <input className="ti" maxLength={4} inputMode="numeric" placeholder="•••" value={nc.cvc} onChange={(e) => setNc({ ...nc, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>
                  </div>
                  <button className="btn-primary sm" type="button" onClick={addNewCard} style={{ marginTop: 12 }}>Add your card</button>
                  {ncErr && <div className="inline-msg error">{ncErr}</div>}
                  <div className="secure-note">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                    Encrypted end-to-end. payUnexa is PCI-DSS Level 1 certified — your full card number and CVV never leave your browser.
                  </div>
                </div>
              </div>
            </div>

            {/* UPI */}
            <div className="pmt-group">
              <div className="pmt-group-title">Pay by UPI</div>
              <PayOpt mkey="upi" title="UPI" sub="Pay instantly from any UPI app" tags="GPay · PhonePe · Paytm · BHIM"
                ico={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><line x1="10.5" y1="18" x2="13.5" y2="18" /></svg>}>
                <div className="upi-grid">
                  <div>
                    <div className="field"><label>Your UPI ID</label></div>
                    <div className="upi-row">
                      <input className="ti" placeholder="yourname@bank" value={upi.id} onChange={(e) => setUpi({ ...upi, id: e.target.value })} />
                      <button className="btn-secondary" type="button" onClick={() => {
                        if (/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upi.id.trim())) { setUpi({ ...upi, ok: true, label: upi.id.trim(), msg: { type: 'success', t: 'Verified — a collect request will be sent to ' + upi.id.trim() } }); toast('UPI ID verified'); }
                        else setUpi({ ...upi, ok: false, msg: { type: 'error', t: 'Invalid UPI ID. Format: name@bank' } });
                      }}>Verify</button>
                    </div>
                    {upi.msg && <div className={`inline-msg ${upi.msg.type}`}>{upi.msg.t}</div>}
                    <div className="mini-label">Or choose an app</div>
                    <div className="chips">{['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((a) => (
                      <button type="button" key={a} className={`chip ${upi.label === a ? 'active' : ''}`} onClick={() => setUpi({ id: '', ok: true, label: a, msg: { type: 'success', t: 'You will approve the payment inside ' + a } })}>{a}</button>
                    ))}</div>
                  </div>
                  <div>
                    <QR />
                    <div className="qr-cap">Scan &amp; pay via any UPI app</div>
                    <button className="btn-ghost" type="button" style={{ display: 'block', margin: '0 auto' }} onClick={() => { setUpi({ id: '', ok: true, label: 'QR code', msg: { type: 'success', t: 'QR scanned — approve in your UPI app' } }); toast('QR scan simulated'); }}>Simulate successful scan</button>
                  </div>
                </div>
              </PayOpt>
            </div>

            {/* Net banking */}
            <div className="pmt-group">
              <div className="pmt-group-title">Net banking</div>
              <PayOpt mkey="netbanking" title="Net Banking" sub="All major banks supported" tags="HDFC · ICICI · Chase · HSBC + more"
                ico={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-6 9 6v1H3z" /><path d="M5 11v7M9.5 11v7M14.5 11v7M19 11v7" /><path d="M3 20h18" /></svg>}>
                <div className="mini-label">Popular banks</div>
                <div className="chips">{BANKS.slice(0, 6).map((b) => (
                  <button type="button" key={b} className={`chip ${bank === b ? 'active' : ''}`} onClick={() => setBank(b)}>{b}</button>
                ))}</div>
                <select className="select" value={BANKS.slice(6).includes(bank) ? bank : ''} onChange={(e) => e.target.value && setBank(e.target.value)}>
                  <option value="">— Choose another bank —</option>{BANKS.slice(6).map((b) => <option key={b}>{b}</option>)}
                </select>
                {bank && <div className="pick-note">You will be redirected to {bank}&apos;s secure portal to complete the payment.</div>}
              </PayOpt>
            </div>

            {/* Wallets */}
            <div className="pmt-group">
              <div className="pmt-group-title">Wallets</div>
              <PayOpt mkey="wallet" title="Wallets" sub="One-tap payment from your wallet balance" tags={walletList.slice(0, 3).join(' · ')}
                ico={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="6.5" width="18" height="13" rx="2.5" /><path d="M3 10.5h18" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" /></svg>}>
                <div className="chips">{walletList.map((w) => (
                  <button type="button" key={w} className={`chip ${walletSel === w ? 'active' : ''}`} onClick={() => setWalletSel(w)}>{w}</button>
                ))}</div>
                {walletSel && <div className="pick-note">You will be redirected to {walletSel} to authorise the payment.</div>}
              </PayOpt>
            </div>

            {/* EMI / Pay later */}
            <div className="pmt-group">
              <div className="pmt-group-title">EMI &amp; Pay Later</div>
              <PayOpt mkey="emi" title="EMI / payUnexa Pay Later" sub="Split your payment into easy monthly instalments" tags="0% APR plans available"
                ico={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>}>
                <div className="emi-head"><span /><span>Plan</span><span>Tenure</span><span>Monthly</span><span>Interest</span><span>APR</span></div>
                {plans.map((p) => (
                  <label key={p.key} className={`emi-row ${emiPlan === p.key ? 'sel' : ''}`}>
                    <input type="radio" name="emi" checked={emiPlan === p.key} onChange={() => setEmiPlan(p.key)} />
                    <span className="e-name">{p.name}</span><span className="e-ten">{p.tenure}</span>
                    <span className="e-mon">{money(p.monthly)}/mo</span>
                    <span className="e-int">{p.interest > 0 ? '+' + money(p.interest) : money(0)}</span>
                    <span className="e-apr">{p.apr}</span>
                  </label>
                ))}
                <div className="emi-fine">No-cost EMI available on select cards. Processing fee may apply per bank terms. Plans recalculated on your total.</div>
              </PayOpt>
            </div>

            {/* COD */}
            <div className="pmt-group">
              <div className="pmt-group-title">Cash on delivery</div>
              <PayOpt mkey="cod" title="Cash on Delivery" sub="Pay when your order is delivered" tags={`+${money(COD_FEE)} handling`}
                ico={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2.5" y="7" width="19" height="10" rx="2" /><circle cx="12" cy="12" r="2.4" /></svg>}>
                <div className="secure-note">A <b>&nbsp;{money(COD_FEE)}&nbsp;</b> handling fee is applied to COD orders. Please keep exact change ready.</div>
              </PayOpt>
            </div>
          </div>

          {/* ---------- 3. REVIEW ---------- */}
          <div className="card">
            <h2><span className="stepnum">3</span> Review &amp; place order</h2>
            <div className="rev-row"><span className="rev-lbl">Paying to</span><span className="rev-val">payUnexa merchant</span></div>
            <div className="rev-row"><span className="rev-lbl">Customer</span><span className="rev-val">{info.name || '—'}<br />{info.email}</span></div>
            <div className="rev-row"><span className="rev-lbl">Payment method</span><span className="rev-val">{method ? methodLabel() : '— not selected —'}</span></div>
            <div className="rev-row"><span className="rev-lbl">Amount</span><span className="rev-val">{money(amt)}</span></div>
            {discount > 0 && <div className="rev-row"><span className="rev-lbl">Discount ({gift.code})</span><span className="rev-val">−{money(discount)}</span></div>}
            {codFee > 0 && <div className="rev-row"><span className="rev-lbl">COD handling</span><span className="rev-val">{money(codFee)}</span></div>}
            <div className="rev-row"><span className="rev-lbl"><b>Total</b></span><span className="rev-val"><b>{money(total)}</b></span></div>
          </div>
        </div>

        {/* ---------- ASIDE ---------- */}
        <aside>
          <div className="card">
            <button className="btn-primary big" disabled={!detailsDone || !ready()} onClick={placeOrder}>
              {detailsDone && ready() ? `Pay ${money(total)}` : 'Complete the steps to pay'}
            </button>
            <div className="btn-hint">{!detailsDone ? 'Enter your details first' : !method ? 'Choose a payment method' : !ready() ? 'Finish the selected method' : 'You will be charged securely'}</div>
            <hr />
            <div className="sum-title">Order Summary</div>
            <div className="sum-line"><span>Amount</span><span>{money(amt)}</span></div>
            {discount > 0 && <div className="sum-line"><span>Discount ({gift.code})</span><span>−{money(discount)}</span></div>}
            {codFee > 0 && <div className="sum-line"><span>COD handling</span><span>{money(codFee)}</span></div>}
            <div className="sum-line total"><span>Total</span><span>{money(total)}</span></div>
            {method === 'emi' && emiPlan && (() => { const p = plans.find((x) => x.key === emiPlan); return <div className="emi-note">or {p.tenure} × {money(p.monthly)} with {p.name} ({p.apr})</div>; })()}
            <div className="cur-note">Charged securely in <b>{currency}</b>. <button className="linklike" type="button" onClick={() => setInfoModal(INFO.fx)}>Learn more</button></div>
            <div className="sum-fine">Card details are tokenized — never stored raw.</div>
          </div>
          <div className="card trust">
            <div className="t-title">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v5c0 4.6-3 8.1-7 9.2C8 19.1 5 15.6 5 11V6z" /><path d="M9 11.5l2 2 4-4" /></svg>
              Why checkout is safe
            </div>
            <ul>
              <li>256-bit TLS encryption on every transaction</li>
              <li>PCI-DSS Level 1 certified infrastructure</li>
              <li>3-D Secure (OTP) authentication supported</li>
              <li>Real-time fraud &amp; risk-scoring engine</li>
              <li>Card details tokenized — never stored raw</li>
            </ul>
            <div className="t-foot">Payments processed by <b>payUnexa</b> · 99.99% uptime SLA</div>
          </div>
        </aside>
      </div>

      <SiteFooter />

      {/* processing overlay */}
      {result === 'processing' && (
        <div className="overlay">
          <div className="proc-card">
            <div className="proc-spinner" />
            <h3>Processing your payment</h3>
            <div className="proc-sub">Please don&apos;t refresh or close this page…</div>
            <ul className="proc-steps">
              {['Authenticating with your ' + (isCard(method) ? 'card issuer' : 'provider'), 'Running payUnexa fraud & risk checks', 'Confirming your order'].map((l, i) => (
                <li key={i} className={`proc-step ${i < procStep ? 'done' : i === procStep ? 'active' : ''}`}><span className="ps-ico" />{l}</li>
              ))}
            </ul>
            <div className="proc-safe">Awaiting confirmation — this may take a moment.</div>
          </div>
        </div>
      )}

      {/* failed */}
      {result === 'failed' && (
        <div className="overlay" onClick={() => setResult(null)}>
          <div className="proc-card" onClick={(e) => e.stopPropagation()}>
            <div className="result-icon bad">✕</div>
            <h3 style={{ marginTop: 12 }}>Payment Declined</h3>
            <div className="proc-sub" style={{ marginTop: 6 }}>Your payment could not be completed. Try another method.</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setResult(null)}>Try again</button>
          </div>
        </div>
      )}

      {/* info modal */}
      {info_modal && (
        <div className="overlay" onClick={() => setInfoModal(null)}>
          <div className="modal sm" onClick={(e) => e.stopPropagation()}>
            <div className="m-head"><h3>{info_modal.t}</h3><button className="m-close" onClick={() => setInfoModal(null)}>✕</button></div>
            <div className="m-body">{info_modal.b}</div>
          </div>
        </div>
      )}

      {/* toasts */}
      <div className="toast-wrap">{toasts.map((t) => <div key={t.id} className={`toast show ${t.type === 'error' ? 'error' : ''}`}>{t.msg}</div>)}</div>
    </>
  );
}
