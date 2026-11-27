import { json, readJson } from '../_shared.js';
import { ensureAccounts } from '../_extra.js';
import { verifyGoogleToken } from '../_google.js';
import { createCar } from '../_register.js';

// Letters only, up to three words. Only the owner ever sees it, so an unusual account name is trimmed, not refused.
export const nameFromGoogle = (name) => String(name || '').normalize('NFKC').split(/\s+/).filter((w) => /^[\p{L}\p{M}'’.\-]+$/u.test(w)).slice(0, 3).join(' ').slice(0, 60) || 'صاحب السيارة';

// Sign in (or sign up) with Google. Existing account: returns the owner key, so a new phone gets the same inbox back.
// New account: needs only the phone number, the car and consent. The name always comes from the verified token.
export async function onRequestPost({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'not_configured' }, 503);
  let b; try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  const g = await verifyGoogleToken(env, b.idToken);
  if (!g) return json({ error: 'bad_token' }, 401);
  await ensureAccounts(env);
  const acc = await env.DB.prepare('SELECT a.car_id, c.owner_key FROM accounts a JOIN cars c ON c.id = a.car_id WHERE a.sub = ?').bind(g.sub).first();
  if (acc) return json({ ok: true, token: acc.car_id, owner_key: acc.owner_key, existing: true });
  if (!b.phone) return json({ ok: false, needs_signup: true, name: g.name, email: g.email });
  const res = await createCar(env, request, { nickname: b.nickname, phone: b.phone, consent: b.consent === true, src: b.src || 'google' }, nameFromGoogle(g.name));
  if (res.status !== 200) return res;
  const out = await res.json();
  await env.DB.prepare('INSERT OR REPLACE INTO accounts (sub, email, car_id) VALUES (?,?,?)').bind(g.sub, g.email, out.token).run();
  return json({ ...out, existing: false });
}
