-- Perfect Circle database tables (Technical Design, "Data model").
-- "IF NOT EXISTS" means running this again on an existing file changes nothing.

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash    TEXT NOT NULL,              -- bcrypt hash; the plain PIN is never stored
  created_at  INTEGER NOT NULL            -- milliseconds since 1970
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,           -- random value stored in the login cookie
  player_id   INTEGER NOT NULL REFERENCES players(id),
  expires_at  INTEGER NOT NULL            -- 30 days after login
);

CREATE TABLE IF NOT EXISTS attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   TEXT NOT NULL UNIQUE,       -- made on the device; stops duplicates on re-sync
  player_id   INTEGER NOT NULL REFERENCES players(id),
  shape       TEXT NOT NULL,              -- circle, square, triangle, star
  mode        TEXT NOT NULL,              -- classic, timed, ink, moving
  limit_s     INTEGER,                    -- time limit in seconds (timed mode only)
  off_hand    INTEGER NOT NULL DEFAULT 0, -- 1 = non-dominant hand
  score       REAL NOT NULL,
  daily_date  TEXT,                       -- 'YYYY-MM-DD' when this was the scored daily attempt
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_player ON attempts(player_id, created_at);

CREATE TABLE IF NOT EXISTS daily_results (
  player_id      INTEGER NOT NULL REFERENCES players(id),
  challenge_date TEXT NOT NULL,           -- 'YYYY-MM-DD' (UTC)
  score          REAL NOT NULL,           -- calculated by the server
  stroke         TEXT NOT NULL,           -- JSON, 128 points
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (player_id, challenge_date) -- one attempt a day
);

CREATE TABLE IF NOT EXISTS badges_earned (
  player_id  INTEGER NOT NULL REFERENCES players(id),
  badge_id   TEXT NOT NULL,
  earned_at  INTEGER NOT NULL,
  PRIMARY KEY (player_id, badge_id)
);

CREATE TABLE IF NOT EXISTS duel_rooms (
  code        TEXT PRIMARY KEY,
  host_id     INTEGER REFERENCES players(id), -- empty for guests who are not logged in
  guest_id    INTEGER REFERENCES players(id),
  status      TEXT NOT NULL,                  -- waiting, playing, finished, expired
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS duel_rounds (
  room_code    TEXT NOT NULL REFERENCES duel_rooms(code),
  round        INTEGER NOT NULL,
  shape        TEXT NOT NULL,
  mode         TEXT NOT NULL,
  host_score   REAL NOT NULL,
  guest_score  REAL NOT NULL,
  winner_id    INTEGER,          -- player id, or empty if the winner was a guest
  winner_seat  TEXT NOT NULL,    -- 'host' or 'guest'
  PRIMARY KEY (room_code, round)
);
