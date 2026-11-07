import { json, rid, carByKey } from './_shared.js';
import { validEndpoint } from './_push.js';

export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const endpoint = String(b?.endpoint || '');
  const p256dh = String(b?.keys?.p256dh || '');
  const auth = String(b?.keys?.auth || '');
  if (!validEndpoint(endpoint) || p256dh.length < 80 || p256dh.length > 100 || auth.length < 20 || auth.length > 30) return json({ error: 'bad_subscription' }, 400);

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE car_id = ?').bind(car.id).first();
  const existing = await env.DB.prepare('SELECT id FROM push_subs WHERE endpoint = ?').bind(endpoint).first();
  if (!existing && count.n >= 5) return json({ error: 'too_many_devices' }, 429);

  if (existing) {
    await env.DB.prepare('UPDATE push_subs SET car_id = ?, p256dh = ?, auth = ? WHERE id = ?').bind(car.id, p256dh, auth, existing.id).run();
  } else {
    await env.DB.prepare('INSERT INTO push_subs (id, car_id, endpoint, p256dh, auth) VALUES (?,?,?,?,?)').bind(rid(14), car.id, endpoint, p256dh, auth).run();
  }
  return json({ ok: true });
}
