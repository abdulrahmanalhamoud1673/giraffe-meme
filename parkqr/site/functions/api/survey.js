import { OPTIONS } from './_shared.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (body.website) return json({ ok: true }); // honeypot: silently drop bots
  const row = {};
  for (const [key, allowed] of Object.entries(OPTIONS)) {
    if (!allowed.includes(body[key])) return json({ error: 'invalid_' + key }, 400);
    row[key] = body[key];
  }
  // flood guard: a bot cannot fill the database (a real campaign stays far below this)
  const flood = await env.DB.prepare("SELECT COUNT(*) AS n FROM responses WHERE created_at > datetime('now','-1 hour')").first();
  if (flood.n >= 300) return json({ error: 'busy' }, 429);
  row.contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 120) : '';
  await env.DB.prepare(
    'INSERT INTO responses (age,city,has_car,freq,habit,would_use,sticker_price,sub_price,worry,contact) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(row.age, row.city, row.has_car, row.freq, row.habit, row.would_use, row.sticker_price, row.sub_price, row.worry, row.contact).run();
  return json({ ok: true });
}
