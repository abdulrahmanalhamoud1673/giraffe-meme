import { json, carByKey } from '../_shared.js';
import { ensureBlocks } from '../_extra.js';

// Owner only: block the device that sent one of their messages. The sender is not told (their messages just stop arriving).
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const m = await env.DB.prepare('SELECT device_hash FROM messages WHERE id = ? AND car_id = ?').bind(String(b.id || ''), car.id).first();
  if (!m || !m.device_hash) return json({ error: 'not_found' }, 404);
  await ensureBlocks(env);
  await env.DB.prepare('INSERT OR IGNORE INTO blocks (car_id, device_hash) VALUES (?,?)').bind(car.id, m.device_hash).run();
  return json({ ok: true });
}
