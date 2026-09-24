// Public: verify an OTP the user typed back.
//   { channel: 'email' | 'whatsapp', target, code }
import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const channel = body.channel === 'whatsapp' ? 'whatsapp' : body.channel === 'email' ? 'email' : null;
  const target = String(body.target || '').trim();
  const code = String(body.code || '').trim();
  if (!channel) return NextResponse.json({ error: 'channel must be email or whatsapp' }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'enter the 6-digit code' }, { status: 400 });

  const result = await verifyOtp(channel, target, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true });
}
