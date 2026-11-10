import { json, carByKey } from './_shared.js';

const AREAS = ['amman', 'irbid', 'zarqa', 'other'];
const PRICES = ['2', '3', '5', 'more'];
const QTYS = [1, 2, 4];
let ensured = false;

// The table is created on first use, so an existing database needs no manual step.
async function ensureTable(env) {
  if (ensured) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS interests (car_id TEXT PRIMARY KEY, area TEXT, qty INTEGER, price TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  ensured = true;
}

// Owner only. GET: what they chose before. POST: "I am interested in a ready-made sticker" (area, quantity, the price they would pay).
export async function onRequestGet({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  await ensureTable(env);
  const row = await env.DB.prepare('SELECT area, qty, price FROM interests WHERE car_id = ?').bind(car.id).first();
  return json({ interest: row || null });
}

export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!AREAS.includes(b.area)) return json({ error: 'bad_area' }, 400);
  if (!PRICES.includes(String(b.price))) return json({ error: 'bad_price' }, 400);
  const qty = Number(b.qty || 1);
  if (!QTYS.includes(qty)) return json({ error: 'bad_qty' }, 400);
  await ensureTable(env);
  await env.DB.prepare('INSERT INTO interests (car_id, area, qty, price) VALUES (?,?,?,?) ON CONFLICT(car_id) DO UPDATE SET area = excluded.area, qty = excluded.qty, price = excluded.price').bind(car.id, b.area, qty, String(b.price)).run();
  return json({ ok: true });
}
