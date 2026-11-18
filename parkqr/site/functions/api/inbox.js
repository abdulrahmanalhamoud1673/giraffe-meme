import { json, carByKey } from './_shared.js';
import { ensurePhotoTable } from './_photo.js';
import { ensureNotes } from './_extra.js';

export async function onRequestGet({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  await ensurePhotoTable(env); await ensureNotes(env);
  const { results } = await env.DB.prepare('SELECT id, kind, reply, created_at, replied_at, EXISTS(SELECT 1 FROM photos p WHERE p.msg_id = messages.id) AS photo, (SELECT text FROM notes n WHERE n.msg_id = messages.id) AS note FROM messages WHERE car_id = ? ORDER BY created_at DESC LIMIT 50').bind(car.id).all();
  return json({ car: { id: car.id, name: car.name, nickname: car.nickname, paused: !!car.paused }, messages: results });
}
