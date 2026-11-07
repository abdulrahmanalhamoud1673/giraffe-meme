import { json, rid, deviceHash } from './_shared.js';
import { validateName, normalizeName, validatePhone } from './_validate.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
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

  const sameNumber = await env.DB.prepare('SELECT COUNT(*) AS n FROM cars WHERE phone = ?').bind(phone).first();
  if (sameNumber.n >= 3) return json({ error: 'phone_limit' }, 429);

  const id = rid(10), owner_key = rid(28);
  await env.DB.prepare('INSERT INTO cars (id, owner_key, name, nickname, phone, ip_hash) VALUES (?,?,?,?,?,?)')
    .bind(id, owner_key, name, nickname, phone, ip_hash).run();
  return json({ ok: true, token: id, owner_key });
}
