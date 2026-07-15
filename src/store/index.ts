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
`;

export type Store = {
  getState(id: string): CardState | null;
  putState(state: CardState): void;
  getDue(now: number, limit: number): CardState[];
  getSeenIds(): Set<string>;
  reset(): void;
};

export function openStore(): Store {
  let db = SQLite.openDatabaseSync("marrow.db");
  try {
    db.execSync(DDL);
  } catch {
    // Corrupt DB: the corpus is intact and progress is not precious in v1, so drop and
    // recreate rather than leaving the user with an app that will not open.
    SQLite.deleteDatabaseSync("marrow.db");
    db = SQLite.openDatabaseSync("marrow.db");
    db.execSync(DDL);
  }

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
    reset() {
      db.execSync("DELETE FROM card_state");
    },
  };
}
