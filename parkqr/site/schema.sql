CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  age TEXT, city TEXT, has_car TEXT, freq TEXT, habit TEXT,
  would_use TEXT, sticker_price TEXT, sub_price TEXT, worry TEXT,
  contact TEXT
);

CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,            -- public token inside the QR (random, no personal data)
  owner_key TEXT NOT NULL UNIQUE, -- secret for the owner's inbox
  name TEXT, nickname TEXT, phone TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  device_hash TEXT,
  reply TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  replied_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_car ON messages(car_id, created_at);

CREATE TABLE IF NOT EXISTS push_subs (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_push_car ON push_subs(car_id);

CREATE TABLE IF NOT EXISTS interests (
  car_id TEXT PRIMARY KEY,
  area TEXT, qty INTEGER, price TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
