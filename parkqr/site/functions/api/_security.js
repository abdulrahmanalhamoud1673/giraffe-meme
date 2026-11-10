// Admin protection. Fails closed: a weak or already-exposed key switches the dashboard off instead of leaving it open.

// SHA-256 of secrets that were pasted into a chat. Only the hashes are stored, never the secrets.
const EXPOSED = {
  ADMIN_KEY: ['9f528ac2359a8edb61428f597e2ba250dd9fc339d78777c65d09c87659aefa2a'],
  SALT: ['de790b4c8fc2be4754a085eb628e59b919315fd7a64df476be414cff30b2caf7'],
  VAPID_PRIVATE: ['0681e72ef1c8ca2a4b214c2a0b47f1d3ad811fc5875b4dc2c5b1074449b5e503'],
};
export const MIN_ADMIN_KEY_LENGTH = 20;

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Compares two equal-length strings without stopping at the first difference.
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Which secrets still hold a value that was exposed in a chat (names only, never values).
export async function exposedSecrets(env) {
  const out = [];
  for (const [name, hashes] of Object.entries(EXPOSED)) {
    if (env[name] && hashes.includes(await sha256Hex(String(env[name])))) out.push(name);
  }
  return out;
}

// -> { ok: true } or { ok: false, status, error }
export async function adminCheck(request, env) {
  const key = env.ADMIN_KEY ? String(env.ADMIN_KEY) : '';
  if (!key) return { ok: false, status: 503, error: 'no_key' };
  if (key.length < MIN_ADMIN_KEY_LENGTH) return { ok: false, status: 503, error: 'weak_key' };
  if ((await exposedSecrets({ ADMIN_KEY: key })).includes('ADMIN_KEY')) return { ok: false, status: 503, error: 'leaked_key' };
  const auth = request.headers.get('authorization') || '';
  // hash both sides so the lengths always match before the constant-time compare
  const given = await sha256Hex(auth), wanted = await sha256Hex('Bearer ' + key);
  return timingSafeEqual(given, wanted) ? { ok: true } : { ok: false, status: 401, error: 'unauthorized' };
}
