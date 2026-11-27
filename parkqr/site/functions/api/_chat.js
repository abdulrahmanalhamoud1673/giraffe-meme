// Short-lived chat attached to one message: the person who scanned (web, no account) and the owner (web or app).
// Text goes through the same filter as notes (no insults, flirting, numbers, links). The thread closes after 6 hours.
import { json, rid, MSG_TEXT, readJson } from './_shared.js';
import { checkTextAI } from './_textcheck.js';
import { sender, isBlocked, ensureOrigins, takeHit } from './_guard.js';
import { ensureChat, ensureBlocks } from './_extra.js';
import { checkNote } from './_notefilter.js';
import { ensurePhotoTable, parsePhoto, checkPhoto, takePhotoCheck, PHOTO_KEEP_SECONDS } from './_photo.js';
import { notifyOwner } from './_push.js';

// A stranger gets a few lines until the owner answers; after that each side has its own share, so neither can use up the other's.
export const CHAT_BEFORE_ANSWER = 3, CHAT_PER_SIDE = 15;
export const CHAT_MAX_TEXT = 140, CHAT_MAX_MESSAGES = 30, CHAT_OPEN_SECONDS = 6 * 3600, CHAT_GAP_SECONDS = 3;

export async function loadThread(env, msgId) {
  await ensureChat(env); await ensureOrigins(env);
  const m = await env.DB.prepare("SELECT m.id, m.car_id, m.kind, m.reply, m.device_hash, m.ip_hash, unixepoch() - m.created_at AS age, c.paused FROM messages m JOIN cars c ON c.id = m.car_id WHERE m.id = ? AND m.kind NOT LIKE 'nudge:%'").bind(String(msgId || '')).first();
  if (!m) return null;
  const { results } = await env.DB.prepare('SELECT id, side, text, photo, created_at FROM chat WHERE msg_id = ? ORDER BY created_at, rowid').bind(m.id).all();
  return { m, messages: results, open: m.age <= CHAT_OPEN_SECONDS && !m.paused };
}

export const view = (t) => json({ open: t.open, messages: t.messages.map((x) => ({ id: x.id, side: x.side, text: x.text, photo: x.photo ? 1 : 0, t: x.created_at })) });

// side: 's' = the person who scanned, 'o' = the owner
export async function postChat({ request, env, waitUntil }, side, msgId, car) {
  let b; try { b = await readJson(request, 420000); } catch { return json({ error: 'bad_json' }, 400); }
  const t = await loadThread(env, msgId); if (!t) return json({ error: 'not_found' }, 404);
  if (car && t.m.car_id !== car.id) return json({ error: 'not_found' }, 404);
  if (!t.open) return json({ error: 'closed' }, 410);
  if (t.messages.length >= CHAT_MAX_MESSAGES) return json({ error: 'limit' }, 429);
  const last = [...t.messages].reverse().find((x) => x.side === side);
  const nowRow = await env.DB.prepare('SELECT unixepoch() AS n').first();
  if (last && nowRow.n - last.created_at < CHAT_GAP_SECONDS) return json({ error: 'slow' }, 429);
  const mine = t.messages.filter((x) => x.side === side);
  if (mine.length >= CHAT_PER_SIDE) return json({ error: 'limit' }, 429);
  const answered = !!t.m.reply || t.messages.some((x) => x.side === 'o');
  const cap = side === 's' && !answered ? CHAT_BEFORE_ANSWER : CHAT_PER_SIDE;
  if (mine.length >= cap) return json({ error: 'wait_owner' }, 429);
  const c = checkNote(b.text, CHAT_MAX_TEXT, mine.map((x) => x.text).join(' '));
  const pic = b.photo ? parsePhoto(b.photo) : null;           // a picture must come straight from the camera (the page/app never offers the gallery)
  if (b.photo && !pic.ok) return json({ error: 'bad_photo' }, 400);
  if (!c.ok || (!c.note && !pic)) return json({ error: 'text_rejected' }, 422);
  const from = await sender(request, env);
  if (side === 's') {
    await ensureBlocks(env);
    // the person who started this thread, or whoever is writing now
    if (await isBlocked(env, t.m.car_id, from.dev, from.net, t.m.device_hash, t.m.ip_hash)) return json({ ok: true });   // silent
  }
  if (!(await takeHit(env, 'chat:' + from.net, 40, 600))) return json({ error: 'slow' }, 429);
  if (c.note && (await checkTextAI(env, c.note)) === 'rejected') return json({ error: 'text_rejected' }, 422);
  if (pic) {
    if (!(await takePhotoCheck(env, from))) return json({ error: 'slow' }, 429);
    const verdict = await checkPhoto(env, pic.b64);
    if (verdict === 'rejected') return json({ error: 'photo_unrelated' }, 422);
    if (verdict !== 'ok') return json({ error: 'photo_check_down' }, 503);
  }
  const cid = rid(14);
  // gap and cap are checked again inside the insert, so parallel requests cannot get past them
  const stored = await env.DB.prepare(
    'INSERT INTO chat (id, msg_id, side, text, photo) SELECT ?1, ?2, ?3, ?4, ?5 WHERE NOT EXISTS (SELECT 1 FROM chat WHERE msg_id = ?2 AND side = ?3 AND created_at > unixepoch() - ?6) AND (SELECT COUNT(*) FROM chat WHERE msg_id = ?2 AND side = ?3) < ?7 RETURNING id')
    .bind(cid, t.m.id, side, c.note || '', pic ? 1 : 0, CHAT_GAP_SECONDS, cap).first();
  if (!stored) return json({ error: 'slow' }, 429);
  await env.DB.prepare('DELETE FROM chat WHERE created_at < unixepoch() - ?').bind(PHOTO_KEEP_SECONDS).run();
  if (pic) {
    await ensurePhotoTable(env);
    await env.DB.prepare('DELETE FROM photos WHERE created_at < unixepoch() - ?').bind(PHOTO_KEEP_SECONDS).run();
    await env.DB.prepare('INSERT INTO photos (msg_id, car_id, data, verdict) VALUES (?,?,?,?)').bind(cid, t.m.car_id, pic.b64, 'chat').run();
  }
  if (side === 's') {
    const tell = notifyOwner(env, t.m.car_id, { title: 'رسالة جديدة: يا نشمي', body: c.note || 'صورة جديدة', url: '/inbox.html', tag: 'yn-chat-' + t.m.id, urgent: false }).catch(() => {});
    if (waitUntil) waitUntil(tell); else await tell;
  }
  return json({ ok: true });
}
