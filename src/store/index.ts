import * as SQLite from "expo-sqlite";
import type { CardState } from "../types";

const DDL = `
CREATE TABLE IF NOT EXISTS card_state (
  cardId       TEXT PRIMARY KEY NOT NULL,
  status       TEXT NOT NULL,
  ease         REAL NOT NULL,
  intervalDays REAL NOT NULL,
  dueAt        INTEGER NOT NULL,
  lapses       INTEGER NOT NULL,
  reps         INTEGER NOT NULL,
  lastSeenAt   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_card_state_dueAt ON card_state(dueAt);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export type Store = {
  getState(id: string): CardState | null;
  putState(state: CardState): void;
  getDue(now: number, limit: number): CardState[];
  getSeenIds(): Set<string>;
  getAllStates(): CardState[];
  getSetting(key: string): string | null;
  putSetting(key: string, value: string): void;
  reset(): void;
};

// Opens marrow.db and ensures the schema exists, recovering from a corrupt database
// file. Both the open and the DDL are guarded, since corruption can surface at either
// step. On failure, the failed handle (if any) is closed before the file is deleted —
// deleting a database file while a native handle is still open can fail or leak a
// native resource on some platforms — and the close itself is guarded too, since a
// handle that is already dead may throw on close, and that must not block recovery.
// The corpus is intact and progress is not precious in v1, so we always drop and
// recreate rather than leaving the user with an app that will not open.
function openAndInit(): SQLite.SQLiteDatabase {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = SQLite.openDatabaseSync("marrow.db");
    db.execSync(DDL);
    return db;
  } catch {
    try {
      db?.closeSync();
    } catch {
      // ignore — handle may already be unusable; recovery must proceed regardless
    }
    SQLite.deleteDatabaseSync("marrow.db");
    const fresh = SQLite.openDatabaseSync("marrow.db");
    fresh.execSync(DDL);
    return fresh;
  }
}

export function openStore(): Store {
  const db = openAndInit();

  return {
    getState(id) {
      return db.getFirstSync<CardState>("SELECT * FROM card_state WHERE cardId = ?", [id]) ?? null;
    },
    putState(s) {
      db.runSync(
        `INSERT INTO card_state (cardId, status, ease, intervalDays, dueAt, lapses, reps, lastSeenAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cardId) DO UPDATE SET
           status=excluded.status, ease=excluded.ease, intervalDays=excluded.intervalDays,
           dueAt=excluded.dueAt, lapses=excluded.lapses, reps=excluded.reps,
           lastSeenAt=excluded.lastSeenAt`,
        [s.cardId, s.status, s.ease, s.intervalDays, s.dueAt, s.lapses, s.reps, s.lastSeenAt],
      );
    },
    getDue(now, limit) {
      return db.getAllSync<CardState>(
        "SELECT * FROM card_state WHERE dueAt <= ? ORDER BY dueAt ASC LIMIT ?",
        [now, limit],
      );
    },
    getSeenIds() {
      const rows = db.getAllSync<{ cardId: string }>("SELECT cardId FROM card_state");
      return new Set(rows.map((r) => r.cardId));
    },
    getAllStates() {
      return db.getAllSync<CardState>("SELECT * FROM card_state");
    },
    getSetting(key) {
      const row = db.getFirstSync<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [key],
      );
      return row?.value ?? null;
    },
    putSetting(key, value) {
      db.runSync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [key, value],
      );
    },
    // Scoped to card_state on purpose: settings such as onboarding completion are not
    // user progress and should survive a data reset.
    reset() {
      db.execSync("DELETE FROM card_state");
    },
  };
}
