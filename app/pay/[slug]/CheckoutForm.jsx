'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { acceptedNetworks, wallets as walletsFor, detectBrand, NETWORK_LABEL } from '@/lib/payment-methods';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';

const COUNTRIES = ['US', 'IN', 'GB', 'CA', 'AU', 'AE', 'SG', 'Other'];
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Citibank', 'Chase', 'Bank of America', 'Barclays', 'HSBC'];
// Demo promo codes (). flat = fixed off in order currency; pct = fraction.
const CODES = { SAVE10: { type: 'pct', value: 0.10, kind: 'Promo code' }, WELCOME5: { type: 'flat', value: 5, kind: 'Gift card' } };
const COD_FEE = 0.99;
// Where the customer lands after a completed payment.
const HOME_URL = 'https://payunexa.com';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 9999;
const SUPPORTED_BRANDS = ['visa', 'mastercard'];
// One friendly, on-brand line for any error anywhere in the checkout.
const SLANG = "Oops, that didn't work — give it another shot.";

// Per-country dialling code + expected national-number length for WhatsApp.
const DIAL = { US: '+1', CA: '+1', IN: '+91', GB: '+44', AU: '+61', AE: '+971', SG: '+65' };
const NSN_LEN = { US: 10, CA: 10, IN: 10, GB: 10, AU: 9, AE: 9, SG: 8 };
function validateWhatsapp(country, raw) {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  const cc = DIAL[country];
  if (!cc) { // 'Other' / unknown — accept any E.164-ish number
    const digits = cleaned.replace(/\D/g, '');
    return cleaned.startsWith('+') && digits.length >= 8 && digits.length <= 15;
  }
  if (!cleaned.startsWith(cc)) return false;
  const nsn = cleaned.slice(cc.length).replace(/\D/g, '');
  const need = NSN_LEN[country];
  return need ? nsn.length === need : (nsn.length >= 6 && nsn.length <= 12);
}

// ---- Address autocomplete: Mapbox primary, Nominatim (OSM) fallback ----
// Set NEXT_PUBLIC_MAPBOX_TOKEN in .env (publishable pk.* token). When unset,
// autocomplete falls back to keyless Nominatim/OSM.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const ISO2 = { US: 'US', IN: 'IN', GB: 'GB', CA: 'CA', AU: 'AU', AE: 'AE', SG: 'SG' };

async function geocodeMapbox(q, country) {
  if (!MAPBOX_TOKEN) throw new Error('no mapbox token');
  const cc = ISO2[country];
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}` +
    `&access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=address${cc ? `&country=${cc}` : ''}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('mapbox');
  const j = await r.json();
  return (j.features || []).map((f) => {
    const p = f.properties || {};
    const c = p.context || {};
    return {
      label: p.full_address || p.name || '',
      line1: p.name || '',
      city: c.place?.name || c.locality?.name || '',
      state: c.region?.name || '',
      zip: c.postcode?.name || '',
      country: (c.country?.country_code || '').toUpperCase(),
    };
  });
}

async function geocodeNominatim(q, country) {
  const cc = ISO2[country];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5` +
    `&q=${encodeURIComponent(q)}${cc ? `&countrycodes=${cc.toLowerCase()}` : ''}`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!r.ok) throw new Error('nominatim');
  const j = await r.json();
  return (j || []).map((it) => {
    const a = it.address || {};
    const line1 = [a.house_number, a.road || a.pedestrian || a.neighbourhood].filter(Boolean).join(' ');
    return {
      label: it.display_name || '',
      line1: line1 || it.name || '',
      city: a.city || a.town || a.village || a.hamlet || a.suburb || '',
      state: a.state || a.region || '',
      zip: a.postcode || '',
      country: (a.country_code || '').toUpperCase(),
    };
  });
}

async function geocode(q, country) {
  try { const m = await geocodeMapbox(q, country); if (m.length) return m; } catch { /* fall through */ }
  try { return await geocodeNominatim(q, country); } catch { return []; }
}
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
  const [step, setStep] = useState(0);                 // 0 details | 1 payment | 2 review
  const [detailsDone, setDetailsDone] = useState(false);
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState({ name: '', email: '', whatsapp: '', phone: '', country: 'US', address1: '', address2: '', city: '', state: '', zip: '' });

  const [method, setMethod] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
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
  const [sug, setSug] = useState([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const sugTimer = useRef(null);
  const blankVrf = { sent: false, verified: false, code: '', loading: false, msg: null };
  const [vrf, setVrf] = useState({ email: { ...blankVrf }, whatsapp: { ...blankVrf } });
  const [shakeKey, setShakeKey] = useState(null);

  const amt = Number(amount) || 0;
  const networks = acceptedNetworks(info.country);
  const walletList = walletsFor(info.country);

  function toast(msg, type = 'ok') {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }

  // Central error feedback: shake the field, buzz (mobile haptics), show the
  // friendly slang line. Pass a field key to shake that input; msg optional.
  function fail(fieldKey, msg) {
    if (fieldKey) {
      setShakeKey(fieldKey);
      setTimeout(() => setShakeKey((k) => (k === fieldKey ? null : k)), 450);
    }
    try { navigator?.vibrate?.(120); } catch { /* unsupported */ }
    toast(msg || SLANG, 'error');
    return false;
  }
  const cls = (key) => 'ti' + (shakeKey === key ? ' shake' : '');

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

  // After a completed payment, send the customer to the payUnexa homepage.
  // Delayed so they can download the invoice first.
  useEffect(() => {
    if (view !== 'success') return;
    const t = setTimeout(() => { window.location.href = HOME_URL; }, 12000);
    return () => clearTimeout(t);
  }, [view]);

  const si = (k) => (e) => setInfo((f) => ({ ...f, [k]: e.target.value }));
  const setField = (k, v) => setInfo((f) => ({ ...f, [k]: v }));

  // --- Hardcoded input guards: block wrong/over-long input at the source ---
  function onAmount(e) {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    const parts = raw.split('.');
    let intp = (parts[0] || '').replace(/^0+(?=\d)/, '').slice(0, 4); // no leading zeros, max 4 digits
    const decp = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : null;
    if (intp === '0' && decp === null) intp = ''; // don't leave a bare 0 / 0000
    let v = intp + (decp !== null ? '.' + decp : '');
    if (v !== '' && v !== '.' && Number(v) > MAX_AMOUNT) return; // never exceed cap
    setAmount(v);
  }
  const onName = (e) => setField('name', e.target.value.replace(/[^\p{L}\s.'-]/gu, '').slice(0, 60));
  const resetVrf = (ch) => setVrf((v) => ({ ...v, [ch]: { ...blankVrf } }));
  const onEmail = (e) => { setField('email', e.target.value.replace(/\s/g, '').slice(0, 254)); resetVrf('email'); };
  // Digits only, single leading '+', capped to the country's max length.
  const onPhoneLike = (k) => (e) => {
    const cc = DIAL[info.country];
    const maxDigits = cc ? cc.replace('+', '').length + (NSN_LEN[info.country] || 12) : 15;
    const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
    setField(k, digits ? '+' + digits : '');
    if (k === 'whatsapp') resetVrf('whatsapp');
  };

  // --- OTP verification (email + WhatsApp) ---
  const setVrfField = (ch, patch) => setVrf((v) => ({ ...v, [ch]: { ...v[ch], ...patch } }));
  async function sendCode(ch) {
    const target = ch === 'email' ? info.email : info.whatsapp;
    if (ch === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) return fail('email');
    if (ch === 'whatsapp' && !validateWhatsapp(info.country, info.whatsapp)) return fail('whatsapp');
    setVrfField(ch, { loading: true, msg: null });
    try {
      const res = await fetch('/api/verify/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: ch, target }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || SLANG);
      setVrfField(ch, { sent: true, loading: false, msg: { type: 'success', t: 'Code sent — check your ' + (ch === 'email' ? 'inbox' : 'WhatsApp') } });
      toast('Verification code sent');
    } catch (e) { setVrfField(ch, { loading: false, msg: { type: 'error', t: e.message } }); fail(ch); }
  }
  async function checkCode(ch) {
    const target = ch === 'email' ? info.email : info.whatsapp;
    const code = vrf[ch].code;
    if (!/^\d{6}$/.test(code)) { setVrfField(ch, { msg: { type: 'error', t: 'Enter the 6-digit code' } }); return fail(ch); }
    setVrfField(ch, { loading: true, msg: null });
    try {
      const res = await fetch('/api/verify/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: ch, target, code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || SLANG);
      setVrfField(ch, { verified: true, loading: false, msg: null });
      toast((ch === 'email' ? 'Email' : 'WhatsApp') + ' verified');
    } catch (e) { setVrfField(ch, { loading: false, msg: { type: 'error', t: e.message } }); fail(ch); }
  }
  function renderVerify(ch) {
    const s = vrf[ch];
    if (s.verified) return <div className="vrf-badge">✓ Verified</div>;
    return (
      <div className="vrf">
        {!s.sent ? (
          <button type="button" className="btn-secondary vrf-btn" disabled={s.loading} onClick={() => sendCode(ch)}>{s.loading ? 'Sending…' : 'Send code'}</button>
        ) : (
          <div className="vrf-row">
            <input className="ti vrf-code" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={s.code}
              onChange={(e) => setVrfField(ch, { code: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            <button type="button" className="btn-secondary vrf-btn" disabled={s.loading} onClick={() => checkCode(ch)}>{s.loading ? 'Checking…' : 'Verify'}</button>
            <button type="button" className="linklike vrf-resend" disabled={s.loading} onClick={() => sendCode(ch)}>Resend</button>
          </div>
        )}
        {s.msg && <div className={`inline-msg ${s.msg.type}`} style={{ marginTop: 6 }}>{s.msg.t}</div>}
      </div>
    );
  }
  // Address type-ahead (Mapbox + Nominatim).
  function onAddress1(e) {
    const v = e.target.value.slice(0, 120);
    setField('address1', v);
    setSugOpen(true);
    clearTimeout(sugTimer.current);
    if (v.trim().length < 3) { setSug([]); setSugLoading(false); return; }
    setSugLoading(true);
    const country = info.country;
    sugTimer.current = setTimeout(async () => {
      const results = await geocode(v.trim(), country);
      setSug(results); setSugLoading(false);
    }, 350);
  }
  function pickAddress(s) {
    setInfo((f) => ({
      ...f,
      address1: s.line1 || f.address1,
      city: s.city || f.city,
      state: s.state || f.state,
      zip: (s.zip || f.zip).toUpperCase(),
      country: COUNTRIES.includes(s.country) ? s.country : f.country,
    }));
    setSug([]); setSugOpen(false);
    toast('Address filled');
  }
  const onCity = (e) => setField('city', e.target.value.replace(/[^\p{L}\s.'-]/gu, '').slice(0, 58));
  const onStateF = (e) => setField('state', e.target.value.replace(/[^\p{L}\s.'-]/gu, '').slice(0, 58));
  const onZip = (e) => setField('zip', e.target.value.replace(/[^A-Za-z0-9 -]/g, '').toUpperCase().slice(0, 10));
  function onCountry(e) {
    const country = e.target.value;
    setInfo((f) => {
      const next = { ...f, country };
      if (!f.whatsapp || f.whatsapp === DIAL[f.country]) next.whatsapp = DIAL[country] || '';
      return next;
    });
    resetVrf('whatsapp');
  }

  function saveDetails(e) {
    e.preventDefault();
    setPayErr('');
    if (!(amt >= MIN_AMOUNT) || amt > MAX_AMOUNT) return fail('amount');
    if (!info.name) return fail('name');
    if (!info.email) return fail('email');
    if (!info.whatsapp) return fail('whatsapp');
    if (!validateWhatsapp(info.country, info.whatsapp)) return fail('whatsapp');
    if (!info.address1) return fail('address1');
    if (!info.city) return fail('city');
    if (!info.state) return fail('state');
    if (!info.zip) return fail('zip');
    if (!vrf.email.verified) return fail('email');
    if (!vrf.whatsapp.verified) return fail('whatsapp');
    setDetailsDone(true);
    setStep(1);
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
    const brand = detectBrand(num);
    if (!SUPPORTED_BRANDS.includes(brand)) { setNcErr('Only Visa and Mastercard cards are supported.'); return; }
    setNcErr('');
    const last4 = num.slice(-4);
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
    if (!detailsDone) return fail(null, 'Complete your details first');
    if (!method) return fail(null, 'Choose a payment method');
    if (method === 'newcard') return fail(null, 'Add your card details first');
    if (!ready()) {
      if (method === 'emi') return fail(null, 'Select an EMI / Pay Later plan');
      if (method === 'wallet') return fail(null, 'Choose a wallet');
      return fail(null, 'Complete the selected method');
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
      if (!res.ok || !data.ok) throw new Error(data.error || SLANG);
      setReference(data.reference || '');
    } catch {
      setResult(null);
      fail(null);
    }
  }

  // Full tax-style invoice opened in a new window; the customer saves it as a
  // PDF via the browser print dialog (Save as PDF).
  function downloadInvoice() {
    const now = new Date();
    const billing = [info.address1, info.address2, info.city, info.state, info.zip, info.country].filter(Boolean).join(', ');
    const contactRows = [
      info.whatsapp && `WhatsApp: ${esc(info.whatsapp)}`,
      info.phone && `Phone: ${esc(info.phone)}`,
      info.email && `Email: ${esc(info.email)}`,
    ].filter(Boolean).map((l) => `<div>${l}</div>`).join('');
    const lineItems = [
      `<tr><td>Amount</td><td class="r">${esc(money(amt))}</td></tr>`,
      discount ? `<tr><td>Discount${gift?.code ? ` (${esc(gift.code)})` : ''}</td><td class="r">−${esc(money(discount))}</td></tr>` : '',
      codFee ? `<tr><td>COD handling fee</td><td class="r">${esc(money(codFee))}</td></tr>` : '',
    ].join('');

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>payUnexa Invoice ${esc(reference)}</title>
<style>
 *{box-sizing:border-box} body{font:14px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0F1111;margin:0;padding:40px;background:#fff}
 .inv{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:34px 38px}
 .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F1111;padding-bottom:18px;margin-bottom:26px}
 .brand{font-size:24px;font-weight:800;letter-spacing:-.5px}.brand .u{color:#FF9900}
 .brand small{display:block;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.3px;margin-top:2px}
 .meta{text-align:right;font-size:12.5px;color:#374151}.meta .t{font-size:15px;font-weight:800;color:#0F1111;letter-spacing:1px}
 .paidtag{display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#066A53;background:#EDF7F2;border:1px solid #B7DFCF;padding:2px 10px;border-radius:999px}
 .cols{display:flex;gap:36px;margin-bottom:26px}.cols>div{flex:1}
 h3{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#6b7280;margin:0 0 8px}
 .name{font-size:15px;font-weight:700}.muted{color:#4b5563;font-size:13px}
 table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:11px 0;border-bottom:1px solid #eee;font-size:14px}.r{text-align:right}
 .total td{border-top:2px solid #0F1111;border-bottom:none;font-weight:800;font-size:17px;padding-top:15px}
 .foot{margin-top:30px;border-top:1px solid #eee;padding-top:16px;font-size:12px;color:#6b7280;text-align:center}
 @media print{body{padding:0}.inv{border:none}}
</style></head>
<body><div class="inv">
 <div class="top">
   <div class="brand">pay<span class="u">Unexa</span><small>payUnexa Technologies · PCI-DSS Level 1</small></div>
   <div class="meta"><div class="t">INVOICE</div>${esc(reference || '—')}<br>${esc(now.toLocaleString())}<div class="paidtag">PAID</div></div>
 </div>
 <div class="cols">
   <div>
     <h3>Billed to</h3>
     <div class="name">${esc(info.name || '—')}</div>
     ${billing ? `<div class="muted">${esc(billing)}</div>` : ''}
     <div style="margin-top:8px">${contactRows}</div>
   </div>
   <div>
     <h3>Payment</h3>
     <div class="muted">Method: ${esc(methodLabel())}</div>
     <div class="muted">Status: Paid</div>
     <div class="muted">Currency: ${esc(currency)}</div>
     <div class="muted">Reference: ${esc(reference || '—')}</div>
   </div>
 </div>
 <table><tbody>
   ${lineItems}
   <tr class="total"><td>Amount paid</td><td class="r">${esc(money(total))}</td></tr>
 </tbody></table>
 <div class="foot">Thank you for paying with payUnexa. This invoice was generated on ${esc(now.toLocaleDateString())}. For help, contact support via your payment confirmation email.</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) { fail(null, 'Allow pop-ups to download the invoice'); return; }
    w.document.write(html);
    w.document.close();
    toast('Invoice ready — Save as PDF');
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
        <SiteHeader title="Order confirmed"  />
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
              <button className="btn-primary" onClick={downloadInvoice}>Download invoice (PDF)</button>
              <button className="btn-secondary" onClick={() => { window.location.href = HOME_URL; }}>Go to payUnexa.com</button>
            </div>
            <p className="succ-sub" style={{ marginTop: 16, fontSize: 12.5 }}>Redirecting you to payUnexa.com in a few seconds…</p>
          </div>
        </section>
        <SiteFooter />
      </>
    );
  }

  const stepIdx = step;
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
      <SiteHeader title="Checkout"  />

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
          {step === 0 && (
          <div className="card">
              <form onSubmit={saveDetails}>
                <h2><span className="stepnum">1</span> Your details</h2>
                <div className="form-grid" style={{ marginTop: 14 }}>
                  <div className="field span2"><label>Amount to pay ({currency}) — {money(MIN_AMOUNT)} to {money(MAX_AMOUNT)}</label>
                    <input className={cls('amount')} type="text" inputMode="decimal" maxLength={7} value={amount} onChange={onAmount} placeholder="0.00" /></div>
                  <div className="field"><label>Full name</label><input className={cls('name')} maxLength={60} value={info.name} onChange={onName} placeholder="Jane Doe" /></div>
                  <div className="field"><label>Email</label><input className={cls('email')} type="email" maxLength={254} value={info.email} onChange={onEmail} placeholder="you@email.com" />{renderVerify('email')}</div>
                  <div className="field"><label>WhatsApp number</label><input className={cls('whatsapp')} type="tel" maxLength={16} value={info.whatsapp} onChange={onPhoneLike('whatsapp')} placeholder={`${DIAL[info.country] || '+'} 555 123 4567`} />{renderVerify('whatsapp')}</div>
                  <div className="field"><label>Phone (optional)</label><input className="ti" type="tel" maxLength={16} value={info.phone} onChange={onPhoneLike('phone')} placeholder="Alternate phone" /></div>
                  <div className="field span2" style={{ position: 'relative' }}><label>Address line 1</label>
                    <input className={cls('address1')} maxLength={120} value={info.address1} onChange={onAddress1} autoComplete="off"
                      onFocus={() => info.address1.trim().length >= 3 && setSugOpen(true)}
                      onBlur={() => setTimeout(() => setSugOpen(false), 150)}
                      placeholder="Start typing your address…" />
                    {sugOpen && (sugLoading || sug.length > 0) && (
                      <div className="addr-sug">
                        {sugLoading && <div className="addr-sug-load">Searching…</div>}
                        {sug.map((s, i) => (
                          <button type="button" key={i} className="addr-sug-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pickAddress(s)}>{s.label}</button>
                        ))}
                        {!sugLoading && sug.length === 0 && <div className="addr-sug-load">No matches</div>}
                      </div>
                    )}
                  </div>
                  <div className="field span2"><label>Address line 2</label><input className="ti" maxLength={120} value={info.address2} onChange={si('address2')} placeholder="Apt, suite (optional)" /></div>
                  <div className="field"><label>City</label><input className={cls('city')} maxLength={58} value={info.city} onChange={onCity} /></div>
                  <div className="field"><label>State / Region</label><input className={cls('state')} maxLength={58} value={info.state} onChange={onStateF} /></div>
                  <div className="field"><label>ZIP / Postal code</label><input className={cls('zip')} maxLength={10} value={info.zip} onChange={onZip} placeholder="10001" /></div>
                  <div className="field"><label>Country</label>
                    <select className="ti" value={info.country} onChange={onCountry}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                </div>
                <button className="btn-primary sm" type="submit" style={{ marginTop: 14 }}>Save &amp; continue</button>
              </form>
          </div>
          )}

          {/* ---------- 2. PAYMENT METHOD ---------- */}
          {step === 1 && (
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
              <div className="pmt-group-title">Cards</div>
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
                  <span><span className="opt-title">Add a new card</span><span className="opt-sub">Visa · Mastercard only — tokenized &amp; secure</span></span>
                  <span className="chev">▾</span>
                </div>
                <div className={`opt-body ${method === 'newcard' ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <div className="net-badges" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {SUPPORTED_BRANDS.map((n) => (
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

            <div className="wiz-nav">
              <button className="btn-secondary" type="button" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary sm" type="button" disabled={!ready()} onClick={() => ready() && setStep(2)}>Continue to review</button>
            </div>
          </div>
          )}

          {/* ---------- 3. REVIEW ---------- */}
          {step === 2 && (
          <div className="card">
            <h2><span className="stepnum">3</span> Review &amp; place order</h2>
            <div className="rev-row"><span className="rev-lbl">Paying to</span><span className="rev-val">payUnexa merchant</span></div>
            <div className="rev-row"><span className="rev-lbl">Customer</span><span className="rev-val">{info.name || '—'}<br />{info.email}</span></div>
            <div className="rev-row"><span className="rev-lbl">Payment method</span><span className="rev-val">{method ? methodLabel() : '— not selected —'}</span></div>
            <div className="rev-row"><span className="rev-lbl">Amount</span><span className="rev-val">{money(amt)}</span></div>
            {discount > 0 && <div className="rev-row"><span className="rev-lbl">Discount ({gift.code})</span><span className="rev-val">−{money(discount)}</span></div>}
            {codFee > 0 && <div className="rev-row"><span className="rev-lbl">COD handling</span><span className="rev-val">{money(codFee)}</span></div>}
            <div className="rev-row"><span className="rev-lbl"><b>Total</b></span><span className="rev-val"><b>{money(total)}</b></span></div>
            <div className="wiz-nav">
              <button className="btn-secondary" type="button" onClick={() => setStep(1)}>Back</button>
            </div>
          </div>
          )}
        </div>

        {/* ---------- ASIDE ---------- */}
        <aside>
          <div className="card">
            <button className="btn-primary big" disabled={step < 2 || !ready()} onClick={placeOrder}>
              {step === 2 && ready() ? `Pay ${money(total)}` : 'Complete the steps to pay'}
            </button>
            <div className="btn-hint">{step === 0 ? 'Enter your details first' : step === 1 ? (!method ? 'Choose a payment method' : !ready() ? 'Finish the selected method' : 'Continue to review') : 'You will be charged securely'}</div>
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
