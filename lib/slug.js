import { randomBytes } from 'node:crypto';

// URL-safe random slug, e.g. XhjdfDoijedfoDHpoohadhef
export function makeSlug(len = 24) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// Human-facing support reference, e.g. NM-LXR9Q4K3
export function makeReference() {
  return 'NM-' + Date.now().toString(36).toUpperCase() + makeSlug(3).toUpperCase();
}
