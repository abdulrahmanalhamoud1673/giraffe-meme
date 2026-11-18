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
