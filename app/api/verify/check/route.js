// Public: verify an OTP the user typed back.
//   { channel: 'email' | 'whatsapp', target, code }
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 }); }

    const channel = body.channel === 'whatsapp' ? 'whatsapp' : body.channel === 'email' ? 'email' : null;
    const target = String(body.target || '').trim();
    const code = String(body.code || '').trim();
    if (!channel) return NextResponse.json({ error: 'Please check your details and try again.' }, { status: 400 });
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });

    const result = await verifyOtp(channel, target, code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, verified: true });
  } catch (e) {
    console.error('[verify/check]', e && e.message);
    return NextResponse.json({ error: 'Verification is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
