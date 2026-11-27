export const REPORT_KEEP_SECONDS = 90 * 86400;
let ensured = false;
export async function ensureReports(env) {
  if (ensured) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS reports (msg_id TEXT PRIMARY KEY, car_id TEXT NOT NULL, kind TEXT NOT NULL, said TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))').run();
  ensured = true;
}
