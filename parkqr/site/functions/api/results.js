import { OPTIONS } from './_shared.js';

const one = async (env, sql) => (await env.DB.prepare(sql).first()) || {};

export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  if (!env.ADMIN_KEY || auth !== 'Bearer ' + env.ADMIN_KEY) {
    return new Response('unauthorized', { status: 401 });
  }
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM responses').first()).n;
  const counts = {};
  for (const key of Object.keys(OPTIONS)) {
    const { results } = await env.DB.prepare(`SELECT ${key} AS v, COUNT(*) AS n FROM responses GROUP BY ${key}`).all();
    counts[key] = Object.fromEntries(results.map(r => [r.v, r.n]));
  }
  const { results: contacts } = await env.DB.prepare("SELECT contact FROM responses WHERE contact != ''").all();
  // Product usage numbers. Counts only: no names, no phone numbers.
  const day = 86400;
  const cars = await one(env, 'SELECT COUNT(*) AS n, SUM(created_at > unixepoch() - ' + day + ') AS d1, SUM(created_at > unixepoch() - ' + 7 * day + ') AS d7 FROM cars');
  const msgs = await one(env, 'SELECT COUNT(*) AS n, SUM(reply IS NOT NULL) AS replied, SUM(created_at > unixepoch() - ' + day + ') AS d1, SUM(created_at > unixepoch() - ' + 7 * day + ') AS d7, AVG(CASE WHEN replied_at IS NOT NULL THEN replied_at - created_at END) AS avg_reply FROM messages WHERE kind NOT LIKE \'nudge:%\'');
  const withMsg = await one(env, "SELECT COUNT(DISTINCT car_id) AS n FROM messages WHERE kind NOT LIKE 'nudge:%'");
  const push = await one(env, 'SELECT COUNT(*) AS devices, COUNT(DISTINCT car_id) AS cars FROM push_subs');
  const { results: perDay } = await env.DB.prepare("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS day, COUNT(*) AS n FROM cars WHERE created_at > unixepoch() - " + 7 * day + ' GROUP BY day ORDER BY day').all();
  let interest = { total: 0, bySizeUnits: 0, byArea: {}, byPrice: {} };
  try {
    const t = await one(env, 'SELECT COUNT(*) AS n, COALESCE(SUM(qty), 0) AS units FROM interests');
    const { results: areas } = await env.DB.prepare('SELECT area AS k, COUNT(*) AS n FROM interests GROUP BY area').all();
    const { results: prices } = await env.DB.prepare('SELECT price AS k, COUNT(*) AS n FROM interests GROUP BY price').all();
    interest = { total: t.n || 0, units: t.units || 0, byArea: Object.fromEntries(areas.map((r) => [r.k, r.n])), byPrice: Object.fromEntries(prices.map((r) => [r.k, r.n])) };
  } catch (_) { /* table not created yet */ }
  const usage = {
    cars: { total: cars.n || 0, last24h: cars.d1 || 0, last7d: cars.d7 || 0, perDay },
    interest,
    pushCars: push.cars || 0,
    pushDevices: push.devices || 0,
    carsWithMessages: withMsg.n || 0,
    messages: { total: msgs.n || 0, replied: msgs.replied || 0, last24h: msgs.d1 || 0, last7d: msgs.d7 || 0, avgReplyMinutes: msgs.avg_reply == null ? null : Math.round(msgs.avg_reply / 6) / 10 },
  };
  return new Response(JSON.stringify({ total, counts, contacts: contacts.map(c => c.contact), usage }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
