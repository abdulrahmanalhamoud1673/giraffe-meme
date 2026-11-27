import { json, carByKey, readJson } from '../_shared.js';
import { ensureBlocks } from '../_extra.js';
import { ensureOrigins } from '../_guard.js';

// Owner only: block the device that sent one of their messages. The sender is not told (their messages just stop arriving).
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b; try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  await ensureOrigins(env);
  const m = await env.DB.prepare('SELECT device_hash, ip_hash FROM messages WHERE id = ? AND car_id = ?').bind(String(b.id || ''), car.id).first();
  if (!m || !m.device_hash) return json({ error: 'not_found' }, 404);
  await ensureBlocks(env);
  for (const k of [m.device_hash, m.ip_hash]) if (k) await env.DB.prepare('INSERT OR IGNORE INTO blocks (car_id, device_hash) VALUES (?,?)').bind(car.id, k).run();
  return json({ ok: true });
}
