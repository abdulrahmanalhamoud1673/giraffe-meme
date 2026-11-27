// Instant notifications to the Android app (Firebase Cloud Messaging, HTTP v1).
// One secret, set by the owner in Cloudflare: FCM_SERVICE_ACCOUNT = the whole JSON file of a Google service account
// that is only allowed to send messages. Nothing happens until it is set.
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';   // fixed here: the address inside the file is never trusted
export const MAX_APP_DEVICES = 5;

export function serviceAccount(env) {
  try {
    const a = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    return a && a.client_email && a.private_key && /^[a-z0-9-]{4,40}$/.test(a.project_id || '') ? a : null;
  } catch { return null; }
}
export const fcmConfigured = (env) => !!serviceAccount(env);

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const part = (obj) => b64u(new TextEncoder().encode(JSON.stringify(obj)));

let cache = { who: '', token: '', until: 0 };
export function _resetFcmCache() { cache = { who: '', token: '', until: 0 }; }

async function accessToken(account, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  if (cache.who === account.client_email && cache.until > now + 60) return cache.token;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = part({ alg: 'RS256', typ: 'JWT' }) + '.' + part({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetchImpl(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64u(sig) }).toString() });
  if (!r.ok) throw new Error('fcm auth ' + r.status);
  const t = await r.json();
  cache = { who: account.client_email, token: t.access_token, until: now + (Number(t.expires_in) || 3600) };
  return cache.token;
}

export async function ensureFcmTable(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS fcm_tokens (token TEXT PRIMARY KEY, car_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_fcm_car ON fcm_tokens(car_id)').run();
}

// Sends to every phone of the owner. Tokens Google says are gone get removed. Never logs the token or the secret.
export async function notifyApp(env, carId, payload, fetchImpl = fetch) {
  const account = serviceAccount(env);
  if (!account) return { sent: 0, failed: 0 };
  await ensureFcmTable(env);
  const { results } = await env.DB.prepare('SELECT token FROM fcm_tokens WHERE car_id = ?').bind(carId).all();
  if (!results.length) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0;
  try {
    const auth = await accessToken(account, fetchImpl);
    for (const row of results) {
      const r = await fetchImpl('https://fcm.googleapis.com/v1/projects/' + account.project_id + '/messages:send', {
        method: 'POST', headers: { authorization: 'Bearer ' + auth, 'content-type': 'application/json' },
        body: JSON.stringify({ message: {
          token: row.token,
          // a "notification" message is shown by Android itself, even when the app is closed
          notification: { title: String(payload.title || 'يا نشمي'), body: String(payload.body || '').slice(0, 200) },
          android: { priority: 'HIGH', ttl: '7200s', notification: { channel_id: payload.urgent ? 'urgent' : 'messages', tag: String(payload.tag || 'yn') } },
        } }),
      });
      if (r.ok) sent++;
      else { failed++; if (r.status === 404) await env.DB.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(row.token).run(); }
    }
  } catch (err) { console.log('fcm failed', String((err && err.message) || err).slice(0, 120)); failed = results.length - sent; }
  return { sent, failed };
}
