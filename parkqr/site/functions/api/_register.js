import { json, rid, deviceHash, readJson } from './_shared.js';
import { ensureSources } from './_extra.js';
import { validateName, normalizeName, validatePhone } from './_validate.js';

// Shared by /api/register and the Google sign-in: validates, applies the limits, stores the car, returns the JSON Response.
export async function createCar(env, request, b) {
  const nameError = validateName(b.name);
  if (nameError) return json({ error: nameError }, 400);
  const name = normalizeName(b.name);
  const nickname = String(b.nickname || '').trim().slice(0, 60);
  const v = validatePhone(b.phone);
  if (v.error) return json({ error: v.error }, 400);
  const phone = v.phone;
  if (b.consent !== true) return json({ error: 'consent_required' }, 400);

  const ip_hash = await deviceHash(request, env);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM cars WHERE ip_hash = ? AND created_at > unixepoch() - 86400').bind(ip_hash).first();
  if (recent.n >= 5) return json({ error: 'rate_limited' }, 429);

  const flood = await env.DB.prepare('SELECT COUNT(*) AS n FROM cars WHERE created_at > unixepoch() - 3600').first();
  if (flood.n >= 300) return json({ error: 'busy' }, 429);   // a bot cannot fill the database (a real launch stays far below this)

  const sameNumber = await env.DB.prepare('SELECT COUNT(*) AS n FROM cars WHERE phone = ?').bind(phone).first();
  if (sameNumber.n >= 3) return json({ error: 'phone_limit' }, 429);

  const id = rid(10), owner_key = rid(28);
  await env.DB.prepare('INSERT INTO cars (id, owner_key, name, nickname, phone, ip_hash) VALUES (?,?,?,?,?,?)')
    .bind(id, owner_key, name, nickname, phone, ip_hash).run();
  const src = String(b.src || '').toLowerCase();
  if (/^[a-z0-9_-]{1,20}$/.test(src)) {
    try { await ensureSources(env); await env.DB.prepare('INSERT OR IGNORE INTO sources (car_id, src) VALUES (?,?)').bind(id, src).run(); } catch (_) { /* never block a registration */ }
  }
  return json({ ok: true, token: id, owner_key });
}
