import { json } from './_shared.js';

// Public: a nickname, whether the sticker is paused, and how fast the owner usually replies. Never the name or phone.
export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const car = await env.DB.prepare('SELECT nickname, paused FROM cars WHERE id = ?').bind(token).first();
  if (!car) return json({ error: 'not_found' }, 404);
  const { results } = await env.DB.prepare("SELECT replied_at - created_at AS d FROM messages WHERE car_id = ? AND replied_at IS NOT NULL AND kind NOT LIKE 'nudge:%' ORDER BY created_at DESC LIMIT 10").bind(token).all();
  let replyMinutes = null;
  if (results.length >= 3) {
    const d = results.map((r) => r.d).sort((a, b) => a - b);
    const median = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
    replyMinutes = Math.max(1, Math.round(median / 60));
  }
  return json({ nickname: car.nickname || '', paused: !!car.paused, replyMinutes });
}
