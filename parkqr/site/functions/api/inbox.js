import { json, carByKey } from './_shared.js';

export async function onRequestGet({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare('SELECT id, kind, reply, created_at, replied_at FROM messages WHERE car_id = ? ORDER BY created_at DESC LIMIT 50').bind(car.id).all();
  return json({ car: { id: car.id, name: car.name, nickname: car.nickname, paused: !!car.paused }, messages: results });
}
