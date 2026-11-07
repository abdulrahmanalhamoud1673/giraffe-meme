import { json } from '../_shared.js';

// Public: reveals only a nickname and whether the sticker is paused. Never the name or phone.
export async function onRequestGet({ params, env }) {
  const car = await env.DB.prepare('SELECT nickname, paused FROM cars WHERE id = ?').bind(params.token).first();
  if (!car) return json({ error: 'not_found' }, 404);
  return json({ nickname: car.nickname || '', paused: !!car.paused });
}
