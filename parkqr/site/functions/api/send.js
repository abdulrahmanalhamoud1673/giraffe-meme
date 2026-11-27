import { json, rid, deviceHash, MSG_KINDS, MSG_TEXT, URGENT_KINDS, readJson } from './_shared.js';
import { notifyOwner } from './_push.js';
import { ensureBlocks, ensureNotes } from './_extra.js';
import { whatsappConfigured, ownerContact, sendWhatsApp } from './_channels.js';
import { checkNote } from './_notefilter.js';
import { PHOTO_KINDS, ensurePhotoTable, parsePhoto, checkPhoto, takePhotoCheck, PHOTO_KEEP_SECONDS } from './_photo.js';

export async function onRequestPost(ctx) {
  try { return await handle({ request: ctx.request, env: ctx.env, waitUntil: ctx.waitUntil ? ctx.waitUntil.bind(ctx) : null }); }
  catch (err) { return json({ error: 'server', detail: String((err && err.message) || err).slice(0, 160) }, 500); }
}

async function handle({ request, env, waitUntil }) {
  let b;
  try { b = await readJson(request, 420000); } catch { return json({ error: 'bad_json' }, 400); }
  if (!MSG_KINDS.includes(b.kind)) return json({ error: 'bad_kind' }, 400);
  const car = await env.DB.prepare('SELECT id, paused FROM cars WHERE id = ?').bind(String(b.token || '')).first();
  if (!car) return json({ error: 'not_found' }, 404);
  if (car.paused) return json({ error: 'paused' }, 423);

  // Optional short note, filtered (no insults, flirting, contact details or links).
  const nc = checkNote(b.note);
  if (!nc.ok) return json({ error: 'note_rejected' }, 422);
  // Problem reports need a photo taken live with the camera.
  let photo = null;
  if (PHOTO_KINDS.includes(b.kind)) {
    const p = parsePhoto(b.photo);
    if (!p.ok) return json({ error: b.photo ? 'bad_photo' : 'photo_required' }, 400);
    photo = p;
  }

  const dev = await deviceHash(request, env);
  await ensureBlocks(env);
  const blocked = await env.DB.prepare('SELECT 1 AS x FROM blocks WHERE car_id = ? AND device_hash = ?').bind(car.id, dev).first();
  if (blocked) return json({ ok: true, id: rid(14) }); // silent: the sender cannot tell
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE car_id = ? AND device_hash = ? AND created_at > unixepoch() - 300').bind(car.id, dev).first();
  if (recent.n >= 1) return json({ error: 'wait' }, 429);
  const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE car_id = ? AND created_at > unixepoch() - 86400 AND kind NOT LIKE \'nudge:%\'').bind(car.id).first();
  if (today.n >= 20) return json({ error: 'daily_limit' }, 429);

  let verdict = null, dropped = false;
  if (photo) {
    if (!(await takePhotoCheck(env, dev))) return json({ error: 'wait' }, 429);
    verdict = await checkPhoto(env, photo.b64);
    if (verdict === 'rejected') return json({ error: 'photo_unrelated' }, 422);
    // The checker is down: the alert still goes out (the car may need help), the unchecked photo does not.
    if (verdict !== 'ok') { photo = null; dropped = true; }
  }
  const id = rid(14);
  await env.DB.prepare('INSERT INTO messages (id, car_id, kind, device_hash) VALUES (?,?,?,?)').bind(id, car.id, b.kind, dev).run();
  if (nc.note) { await ensureNotes(env); await env.DB.prepare('INSERT INTO notes (msg_id, car_id, text) VALUES (?,?,?)').bind(id, car.id, nc.note).run(); }
  if (photo) {
    await ensurePhotoTable(env);
    await env.DB.prepare('DELETE FROM photos WHERE created_at < unixepoch() - ?').bind(PHOTO_KEEP_SECONDS).run();
    await env.DB.prepare('INSERT INTO photos (msg_id, car_id, data, verdict) VALUES (?,?,?,?)').bind(id, car.id, photo.b64, verdict).run();
  }
  // Tell the owner right away. Never let a notification problem fail the sender's request.
  const urgent = URGENT_KINDS.includes(b.kind);
  const tell = notifyOwner(env, car.id, { title: urgent ? 'عاجل: يا نشمي' : 'يا نشمي', body: MSG_TEXT[b.kind] + (photo ? ' (مع صورة)' : ''), url: '/inbox.html', tag: 'yn-' + id, urgent }).catch(() => {});
  const wa = whatsappConfigured(env)
    ? ownerContact(env, car.id).then((c) => sendWhatsApp(env, c, MSG_TEXT[b.kind] + (photo ? ' (مع صورة)' : ''))).catch(() => {})
    : Promise.resolve();
  if (waitUntil) { waitUntil(tell); waitUntil(wa); } else { await tell; await wa; }
  return json(dropped ? { ok: true, id, photo_dropped: true } : { ok: true, id });
}
