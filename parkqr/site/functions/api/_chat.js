// Short-lived chat attached to one message: the person who scanned (web, no account) and the owner (web or app).
// Text goes through the same filter as notes (no insults, flirting, numbers, links). The thread closes after 6 hours.
import { json, rid, deviceHash, MSG_TEXT, readJson } from './_shared.js';
import { ensureChat, ensureBlocks } from './_extra.js';
import { checkNote } from './_notefilter.js';
import { notifyOwner } from './_push.js';

export const CHAT_MAX_TEXT = 140, CHAT_MAX_MESSAGES = 30, CHAT_OPEN_SECONDS = 6 * 3600, CHAT_GAP_SECONDS = 3;

export async function loadThread(env, msgId) {
  await ensureChat(env);
  const m = await env.DB.prepare("SELECT m.id, m.car_id, m.kind, unixepoch() - m.created_at AS age, c.paused FROM messages m JOIN cars c ON c.id = m.car_id WHERE m.id = ? AND m.kind NOT LIKE 'nudge:%'").bind(String(msgId || '')).first();
  if (!m) return null;
  const { results } = await env.DB.prepare('SELECT side, text, created_at FROM chat WHERE msg_id = ? ORDER BY created_at, rowid').bind(m.id).all();
  return { m, messages: results, open: m.age <= CHAT_OPEN_SECONDS && !m.paused };
}

export const view = (t) => json({ open: t.open, messages: t.messages.map((x) => ({ side: x.side, text: x.text, t: x.created_at })) });

// side: 's' = the person who scanned, 'o' = the owner
export async function postChat({ request, env, waitUntil }, side, msgId, car) {
  let b; try { b = await readJson(request, 2048); } catch { return json({ error: 'bad_json' }, 400); }
  const t = await loadThread(env, msgId); if (!t) return json({ error: 'not_found' }, 404);
  if (car && t.m.car_id !== car.id) return json({ error: 'not_found' }, 404);
  if (!t.open) return json({ error: 'closed' }, 410);
  if (t.messages.length >= CHAT_MAX_MESSAGES) return json({ error: 'limit' }, 429);
  const last = [...t.messages].reverse().find((x) => x.side === side);
  const nowRow = await env.DB.prepare('SELECT unixepoch() AS n').first();
  if (last && nowRow.n - last.created_at < CHAT_GAP_SECONDS) return json({ error: 'slow' }, 429);
  const c = checkNote(b.text, CHAT_MAX_TEXT);
  if (!c.ok || !c.note) return json({ error: 'text_rejected' }, 422);
  if (side === 's') {
    await ensureBlocks(env);
    const dev = await deviceHash(request, env);
    const blocked = await env.DB.prepare('SELECT 1 AS x FROM blocks WHERE car_id = ? AND device_hash = ?').bind(t.m.car_id, dev).first();
    if (blocked) return json({ ok: true });   // silent
  }
  await env.DB.prepare('INSERT INTO chat (id, msg_id, side, text) VALUES (?,?,?,?)').bind(rid(14), t.m.id, side, c.note).run();
  if (side === 's') {
    const tell = notifyOwner(env, t.m.car_id, { title: 'رسالة جديدة: يا نشمي', body: c.note, url: '/inbox.html', tag: 'yn-chat-' + t.m.id, urgent: false }).catch(() => {});
    if (waitUntil) waitUntil(tell); else await tell;
  }
  return json({ ok: true });
}
