// Verifies a "Sign in with Google" ID token (RS256) against Google's public keys. Nothing secret is needed:
// only GOOGLE_CLIENT_ID (the public OAuth client id; several can be listed with commas: web + android).
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
let cache = { at: 0, keys: [] };

async function keys(fetchImpl) {
  if (Date.now() - cache.at < 3600e3 && cache.keys.length) return cache.keys;
  const r = await fetchImpl('https://www.googleapis.com/oauth2/v3/certs'); if (!r.ok) throw new Error('certs');
  cache = { at: Date.now(), keys: (await r.json()).keys || [] }; return cache.keys;
}
export function _resetGoogleCache() { cache = { at: 0, keys: [] }; }

// Returns { sub, email, name } or null.
export async function verifyGoogleToken(env, idToken, fetchImpl = fetch) {
  try {
    const ids = String(env.GOOGLE_CLIENT_ID || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!ids.length || typeof idToken !== 'string' || idToken.length > 4096) return null;
    const [h, p, sig] = idToken.split('.'); if (!h || !p || !sig) return null;
    const head = JSON.parse(new TextDecoder().decode(b64u(h)));
    if (head.alg !== 'RS256') return null;
    const jwk = (await keys(fetchImpl)).find((k) => k.kid === head.kid); if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p)); if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(c.iss)) return null;
    if (!ids.includes(c.aud)) return null;
    if (!(c.exp > Date.now() / 1000)) return null;
    if (c.email_verified !== true && c.email_verified !== 'true') return null;
    if (!c.sub || !c.email) return null;
    return { sub: String(c.sub), email: String(c.email), name: String(c.name || '') };
  } catch { return null; }
}
