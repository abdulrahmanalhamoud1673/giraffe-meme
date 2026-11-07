import { json, rid, deviceHash, normalizeJoPhone } from './_shared.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
  const name = String(b.name || '').trim().slice(0, 60);
  const nickname = String(b.nickname || '').trim().slice(0, 60);
  const phone = normalizeJoPhone(b.phone);
  if (!name) return json({ error: 'name_required' }, 400);
  if (!phone) return json({ error: 'bad_phone' }, 400);
  if (b.consent !== true) return json({ error: 'consent_required' }, 400);

  const ip_hash = await deviceHash(request, env);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM cars WHERE ip_hash = ? AND created_at > unixepoch() - 86400').bind(ip_hash).first();
  if (recent.n >= 5) return json({ error: 'rate_limited' }, 429);

  const id = rid(10), owner_key = rid(28);
  await env.DB.prepare('INSERT INTO cars (id, owner_key, name, nickname, phone, ip_hash) VALUES (?,?,?,?,?,?)')
    .bind(id, owner_key, name, nickname, phone, ip_hash).run();
  return json({ ok: true, token: id, owner_key });
}
