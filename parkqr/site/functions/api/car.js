import { json } from './_shared.js';

// Public: reveals only a nickname and whether the sticker is paused. Never the name or phone.
export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const car = await env.DB.prepare('SELECT nickname, paused FROM cars WHERE id = ?').bind(token).first();
  if (!car) return json({ error: 'not_found' }, 404);
  return json({ nickname: car.nickname || '', paused: !!car.paused });
}
