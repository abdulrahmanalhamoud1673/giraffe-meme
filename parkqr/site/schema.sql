CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  age TEXT, city TEXT, has_car TEXT, freq TEXT, habit TEXT,
  would_use TEXT, sticker_price TEXT, sub_price TEXT, worry TEXT,
  contact TEXT
);
