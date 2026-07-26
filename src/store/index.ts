import * as SQLite from "expo-sqlite";
import type { CardState, Grade, ReviewLogEntry } from "../types";

// Every table is created IF NOT EXISTS, so an install carrying only the v1 tables
// (card_state, settings) picks up review_log and bookmarks on next launch with its
// existing progress intact. No destructive migration is needed.
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
CREATE TABLE IF NOT EXISTS review_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  cardId TEXT NOT NULL,
  grade  TEXT NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_log_at ON review_log(at);
CREATE TABLE IF NOT EXISTS bookmarks (
  cardId    TEXT PRIMARY KEY NOT NULL,
  createdAt INTEGER NOT NULL
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
  /** Appends one graded answer. Called alongside putState on every grade. */
  logReview(entry: ReviewLogEntry): void;
  /** Every logged answer at or after `since`, oldest first. */
  getReviewLog(since: number): ReviewLogEntry[];
  getBookmarks(): string[];
  /** Flips the bookmark for a card and returns its new state. */
  toggleBookmark(cardId: string, now: number): boolean;
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
    logReview(entry) {
      db.runSync("INSERT INTO review_log (cardId, grade, at) VALUES (?, ?, ?)", [
        entry.cardId,
        entry.grade,
        entry.at,
      ]);
    },
    getReviewLog(since) {
      return db.getAllSync<{ cardId: string; grade: Grade; at: number }>(
        "SELECT cardId, grade, at FROM review_log WHERE at >= ? ORDER BY at ASC",
        [since],
      );
    },
    getBookmarks() {
      const rows = db.getAllSync<{ cardId: string }>(
        "SELECT cardId FROM bookmarks ORDER BY createdAt DESC",
      );
      return rows.map((r) => r.cardId);
    },
    toggleBookmark(cardId, now) {
      const existing = db.getFirstSync<{ cardId: string }>(
        "SELECT cardId FROM bookmarks WHERE cardId = ?",
        [cardId],
      );
      if (existing) {
        db.runSync("DELETE FROM bookmarks WHERE cardId = ?", [cardId]);
        return false;
      }
      db.runSync("INSERT INTO bookmarks (cardId, createdAt) VALUES (?, ?)", [cardId, now]);
      return true;
    },
    // Clears learning progress and its history. Settings (onboarding completion, daily
    // goal, subject filter) and bookmarks are user preferences and saved content rather
    // than progress, so they deliberately survive a reset.
    reset() {
      db.execSync("DELETE FROM card_state; DELETE FROM review_log;");
    },
  };
}
