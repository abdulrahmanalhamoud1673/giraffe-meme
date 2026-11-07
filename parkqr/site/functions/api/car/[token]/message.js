import { json, rid, deviceHash, MSG_KINDS } from '../../_shared.js';

export async function onRequestPost(ctx) {
  try { return await handle(ctx); }
  catch (err) { return json({ error: 'server', detail: String(err && err.message || err).slice(0, 160) }, 500); }
}

async function handle({ params, request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!MSG_KINDS.includes(b.kind)) return json({ error: 'bad_kind' }, 400);
  const car = await env.DB.prepare('SELECT id, paused FROM cars WHERE id = ?').bind(params.token).first();
  if (!car) return json({ error: 'not_found' }, 404);
  if (car.paused) return json({ error: 'paused' }, 423);

  const dev = await deviceHash(request, env);
  const lastFromDevice = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE car_id = ? AND device_hash = ? AND created_at > unixepoch() - 300').bind(car.id, dev).first();
  if (lastFromDevice.n >= 1) return json({ error: 'wait' }, 429);
  const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE car_id = ? AND created_at > unixepoch() - 86400').bind(car.id).first();
  if (today.n >= 20) return json({ error: 'daily_limit' }, 429);

  const id = rid(14);
  await env.DB.prepare('INSERT INTO messages (id, car_id, kind, device_hash) VALUES (?,?,?,?)').bind(id, car.id, b.kind, dev).run();
  return json({ ok: true, id });
}
