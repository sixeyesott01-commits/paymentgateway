// Public: send an OTP to an email or WhatsApp number.
//   { channel: 'email' | 'whatsapp', target: '<email or +phone>' }
import { NextResponse } from 'next/server';
import { sendOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 }); }

    const channel = body.channel === 'whatsapp' ? 'whatsapp' : body.channel === 'email' ? 'email' : null;
    const target = String(body.target || '').trim();
    if (!channel) return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 });
    if (channel === 'email' && !isEmail(target)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (channel === 'whatsapp' && target.replace(/\D/g, '').length < 8) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });

    const result = await sendOtp(channel, target);
    if (!result.ok) return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 429 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[verify/send]', e && e.message);
    return NextResponse.json({ error: 'Verification is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
