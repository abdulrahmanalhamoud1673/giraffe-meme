import { json, carByKey, REPLY_KINDS, readJson } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  if (!REPLY_KINDS.includes(b.reply)) return json({ error: 'bad_reply' }, 400);
  const r = await env.DB.prepare('UPDATE messages SET reply = ?, replied_at = unixepoch() WHERE id = ? AND car_id = ?').bind(b.reply, String(b.id), car.id).run();
  return json({ ok: true });
}
