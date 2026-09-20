// Server-only Supabase admin client (service role). Bypasses RLS.
// NEVER import this into a client component / expose the service key.
import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getSupabaseAdmin() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_url;
  // Accept several names for the SAME server-only secret (legacy service_role,
  // new "secret key", and the lowercase name the Supabase/Vercel integration
  // sometimes creates). Never expose this key to the browser.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.supabase_secret_key;
  if (!url || !key) {
    console.error(
      '[supabase] Missing Supabase URL or secret key. Set NEXT_PUBLIC_SUPABASE_URL and one of ' +
        'SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / supabase_secret_key.'
    );
    return null;
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
