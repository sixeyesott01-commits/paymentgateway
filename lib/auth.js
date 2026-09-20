// Minimal admin gate: a single shared secret token. No user accounts.
// The token can be sent as `Authorization: Bearer <token>` or `x-admin-token` header.
import { timingSafeEqual } from 'node:crypto';

export function checkAdmin(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || req.headers.get('x-admin-token') || '';

  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
