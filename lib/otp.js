// OTP send/verify for email + WhatsApp. Codes are stored hashed in Upstash with
// a TTL, so plaintext never persists. Email uses Brevo (primary) then Resend
// (fallback); WhatsApp uses the Meta Cloud API. Server-only.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { redisSet, redisGet, redisDel, redisTtl } from './redis';

const TTL = 600;          // code lifetime, seconds (10 min)
const COOLDOWN = 60;      // min seconds between sends
const MAX_ATTEMPTS = 5;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const genCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

function normalize(channel, target) {
  const t = String(target || '').trim();
  return channel === 'email' ? t.toLowerCase() : t.replace(/[^\d+]/g, '');
}
const codeKey = (channel, target) => `otp:${channel}:${normalize(channel, target)}`;
const cdKey = (channel, target) => `otpcd:${channel}:${normalize(channel, target)}`;

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// --- Email delivery ---------------------------------------------------------
async function sendEmailBrevo(to, subject, html) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('brevo not configured');
  const sender = parseSender(process.env.BREVO_SENDER);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`brevo ${res.status}: ${await res.text().catch(() => '')}`);
  return 'brevo';
}

async function sendEmailResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('resend not configured');
  const from = process.env.RESEND_FROM || 'payUnexa <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text().catch(() => '')}`);
  return 'resend';
}

function parseSender(raw) {
  // "Name <email@x.com>" -> { name, email }; "email@x.com" -> { email }
  const s = String(raw || 'payUnexa <verify@payunexa.com>');
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  return m ? { name: m[1] || 'payUnexa', email: m[2] } : { email: s.trim() };
}

async function deliverEmail(to, code) {
  const subject = 'Your payUnexa verification code';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0F1111">
    <p>Your payUnexa verification code is:</p>
    <p style="font-size:30px;font-weight:800;letter-spacing:6px">${code}</p>
    <p style="color:#6b7280;font-size:13px">Valid for 10 minutes. If you didn't request this, ignore this email.</p></div>`;
  // Brevo primary, Resend fallback.
  try { return await sendEmailBrevo(to, subject, html); }
  catch { return await sendEmailResend(to, subject, html); }
}

// --- WhatsApp delivery ------------------------------------------------------
async function deliverWhatsapp(to, code) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const template = process.env.WHATSAPP_TEMPLATE;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  if (!token || !phoneId || !template) throw new Error('whatsapp not configured');
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/[^\d]/g, ''),
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${await res.text().catch(() => '')}`);
  return 'whatsapp';
}

// --- Public API -------------------------------------------------------------
export async function sendOtp(channel, target) {
  const t = normalize(channel, target);
  if (!t) return { ok: false, error: 'missing target' };

  // resend cooldown
  const cd = await redisTtl(cdKey(channel, target));
  if (typeof cd === 'number' && cd > 0) {
    return { ok: false, error: `Please wait ${cd}s before requesting a new code`, retryAfter: cd };
  }

  const code = genCode();
  const record = JSON.stringify({ hash: sha(code), attempts: 0 });

  let provider;
  try {
    provider = channel === 'email' ? await deliverEmail(t, code) : await deliverWhatsapp(t, code);
  } catch (e) {
    // Log the technical reason (config/provider) server-side; never leak it.
    console.error('[otp] send failed:', e && e.message);
    const label = channel === 'email' ? 'email' : 'WhatsApp';
    return { ok: false, error: `We couldn't send the ${label} code right now. Please try again shortly.` };
  }

  await redisSet(codeKey(channel, target), record, TTL);
  await redisSet(cdKey(channel, target), '1', COOLDOWN);
  return { ok: true, provider };
}

export async function verifyOtp(channel, target, code) {
  const raw = await redisGet(codeKey(channel, target));
  if (!raw) return { ok: false, error: 'Code expired or not found. Request a new one.' };
  let rec;
  try { rec = JSON.parse(raw); } catch { return { ok: false, error: 'Something went wrong. Please request a new code.' }; }

  if (rec.attempts >= MAX_ATTEMPTS) {
    await redisDel(codeKey(channel, target));
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }

  if (safeEqualHex(rec.hash, sha(String(code || '').trim()))) {
    await redisDel(codeKey(channel, target));
    return { ok: true, verified: true };
  }

  rec.attempts += 1;
  await redisSet(codeKey(channel, target), JSON.stringify(rec), null, true); // keep TTL
  return { ok: false, error: `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempts left.` };
}
