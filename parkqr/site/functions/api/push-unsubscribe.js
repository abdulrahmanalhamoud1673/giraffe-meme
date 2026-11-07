import { json, carByKey } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  await env.DB.prepare('DELETE FROM push_subs WHERE car_id = ? AND endpoint = ?').bind(car.id, String(b?.endpoint || '')).run();
  return json({ ok: true });
}
