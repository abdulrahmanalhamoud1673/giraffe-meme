import { json, carByKey, readJson } from '../_shared.js';
import { ensureBlocks, ensureNotes, ensureChat } from '../_extra.js';
import { ensureOrigins } from '../_guard.js';
import { ensureReports, REPORT_KEEP_SECONDS } from '../_reports.js';

// Owner only: "this person sent something that is not allowed". Keeps a copy of what they wrote (it would otherwise
// disappear with the 7-day cleanup) for the service to review, and blocks them for this car.
export async function onRequestPost({ request, env }) {
  const car = await carByKey(env, request);
  if (!car) return json({ error: 'unauthorized' }, 401);
  let b; try { b = await readJson(request, 4096); } catch { return json({ error: 'bad_json' }, 400); }
  await ensureOrigins(env); await ensureNotes(env); await ensureChat(env); await ensureBlocks(env); await ensureReports(env);
  const m = await env.DB.prepare("SELECT id, kind, device_hash, ip_hash FROM messages WHERE id = ? AND car_id = ? AND kind NOT LIKE 'nudge:%'").bind(String(b.id || ''), car.id).first();
  if (!m) return json({ error: 'not_found' }, 404);
  const note = await env.DB.prepare('SELECT text FROM notes WHERE msg_id = ?').bind(m.id).first();
  const { results } = await env.DB.prepare("SELECT text, photo FROM chat WHERE msg_id = ? AND side = 's' ORDER BY created_at LIMIT 20").bind(m.id).all();
  const said = [note && note.text, ...results.map((r) => r.text || (r.photo ? '[صورة]' : ''))].filter(Boolean).join(' | ').slice(0, 1500);
  await env.DB.prepare('DELETE FROM reports WHERE created_at < unixepoch() - ?').bind(REPORT_KEEP_SECONDS).run();
  await env.DB.prepare('INSERT OR IGNORE INTO reports (msg_id, car_id, kind, said) VALUES (?,?,?,?)').bind(m.id, car.id, m.kind, said).run();
  for (const k of [m.device_hash, m.ip_hash]) if (k) await env.DB.prepare('INSERT OR IGNORE INTO blocks (car_id, device_hash) VALUES (?,?)').bind(car.id, k).run();
  return json({ ok: true });
}
