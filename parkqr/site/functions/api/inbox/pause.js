import { json, carByKey } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  await env.DB.prepare('UPDATE cars SET paused = ? WHERE id = ?').bind(b.paused ? 1 : 0, car.id).run();
  return json({ ok: true, paused: !!b.paused });
}
