// Minimal Upstash Redis REST client (server-only). One command per call via the
// Upstash REST API: POST {URL} with a JSON array body ["SET","key","val",...].
// https://upstash.com/docs/redis/features/restapi

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function redisReady() {
  return Boolean(URL && TOKEN);
}

async function command(args) {
  if (!redisReady()) throw new Error('Upstash Redis not configured');
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `redis ${res.status}`);
  return data.result;
}

// SET key value with TTL (seconds). Optionally keep existing TTL.
export function redisSet(key, value, exSeconds, keepTtl = false) {
  const args = ['SET', key, value];
  if (keepTtl) args.push('KEEPTTL');
  else if (exSeconds) args.push('EX', String(exSeconds));
  return command(args);
}

export function redisGet(key) {
  return command(['GET', key]);
}

export function redisDel(key) {
  return command(['DEL', key]);
}

// TTL in seconds; -2 = no key, -1 = no expiry.
export function redisTtl(key) {
  return command(['TTL', key]);
}
