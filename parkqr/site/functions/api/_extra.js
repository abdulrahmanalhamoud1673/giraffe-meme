// Small tables that are created on first use, so an existing database needs no manual step.
let s = false, b = false;
export async function ensureSources(env) {
  if (s) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS sources (car_id TEXT PRIMARY KEY, src TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  s = true;
}
export async function ensureBlocks(env) {
  if (b) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS blocks (car_id TEXT NOT NULL, device_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (car_id, device_hash))').run();
  b = true;
}
let nt = false;
export async function ensureNotes(env) {
  if (nt) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS notes (msg_id TEXT PRIMARY KEY, car_id TEXT NOT NULL, text TEXT NOT NULL)').run();
  nt = true;
}
let ch = false;
export async function ensureChat(env) {
  if (ch) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, msg_id TEXT NOT NULL, side TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_msg ON chat(msg_id, created_at)').run();
  try { await env.DB.prepare('ALTER TABLE chat ADD COLUMN photo INTEGER NOT NULL DEFAULT 0').run(); } catch (_) { /* column already there */ }
  ch = true;
}
let ac = false;
export async function ensureAccounts(env) {
  if (ac) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS accounts (sub TEXT PRIMARY KEY, email TEXT NOT NULL, car_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  ac = true;
}
