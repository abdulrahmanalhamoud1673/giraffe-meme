// Web Push (RFC 8030 + RFC 8291 aes128gcm + RFC 8292 VAPID) using only WebCrypto, so it runs in Cloudflare Workers.

const enc = new TextEncoder();
const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  },
};
const concat = (...a) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// Encrypts `plaintext` (Uint8Array) for one subscription. `fixed` is only used by tests.
export async function encryptPayload(plaintext, p256dhB64, authB64, fixed) {
  const uaPublic = b64u.dec(p256dhB64);
  const authSecret = b64u.dec(authB64);
  const salt = fixed?.salt || crypto.getRandomValues(new Uint8Array(16));

  const asKeys = fixed?.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const padded = concat(plaintext, new Uint8Array([2])); // single record, last-record delimiter
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, padded));

  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export async function vapidJwt(env, audience, nowSec) {
  const pub = b64u.dec(env.VAPID_PUBLIC);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), d: env.VAPID_PRIVATE, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600;
  const claims = b64u.enc(enc.encode(JSON.stringify({ aud: audience, exp, sub: env.VAPID_SUBJECT || 'https://yanashmi.com' })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + claims)));
  return header + '.' + claims + '.' + b64u.enc(sig); // WebCrypto already returns raw r||s
}

export function pushConfigured(env) {
  return Boolean(env.VAPID_PUBLIC && env.VAPID_PRIVATE);
}

// Sends one notification. Returns the HTTP status from the push service (or 0 on network failure).
export async function sendPush(env, sub, payload, opts = {}) {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
  const jwt = await vapidJwt(env, new URL(sub.endpoint).origin);
  try {
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttl || 7200),
        Urgency: 'high',
      },
      body,
    });
    return r.status;
  } catch (_) {
    return 0;
  }
}

const ALLOWED_PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.push\.apple\.com$/, /\.windows\.com$/];
export function validEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && ALLOWED_PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch (_) {
    return false;
  }
}

// Notifies every device of a car owner. Dead subscriptions (404/410) are removed.
export async function notifyOwner(env, carId, payload) {
  if (!pushConfigured(env)) return { sent: 0, failed: 0, skipped: true };
  const { results } = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subs WHERE car_id = ?').bind(carId).all();
  let sent = 0, failed = 0;
  for (const sub of results) {
    const status = await sendPush(env, sub, payload);
    if (status >= 200 && status < 300) sent++;
    else {
      failed++;
      if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(sub.id).run();
    }
  }
  return { sent, failed };
}
