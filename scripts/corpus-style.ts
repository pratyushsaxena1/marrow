/**
 * Style checks for the corpus prose, complementing scripts/validate-corpus.ts.
 *
 * validate-corpus enforces the SCHEMA: a card is well formed, in range, unique.
 * This script enforces the VOICE: that the cards do not read as machine output.
 * The two are separate because a corpus can be perfectly valid and still be
 * obviously generated, and the second failure is the one that loses a reader.
 *
 * Every threshold here came from auditing the 230-card corpus and finding the
 * specific patterns that gave it away. See CLAUDE.md for the reasoning behind
 * each rule. Run with: npm run corpus-style
 */
import * as fs from "fs";
import * as path from "path";
import { DOMAINS } from "../src/constants";
import type { Card } from "../src/types";

type Failure = { file: string; rule: string; detail: string };

const failures: Failure[] = [];
const note = (file: string, rule: string, detail: string) =>
  failures.push({ file, rule, detail });

const words = (s: string): string[] => s.trim().split(/\s+/);
const pct = (n: number, total: number): string => `${((n / total) * 100).toFixed(0)}%`;

/** Prose fields only. `topic` and `tags` are machine-facing keys, not reader-facing text. */
const prose = (c: Card): string => [c.title, c.body, c.prompt, c.answer].join("\n");

// Rule 1: dashes. The em dash is the single loudest tell and is banned outright.
// The en dash is banned with it so that "replace the em dash" cannot be satisfied
// by reaching for a lookalike. Hyphens are fine.
const DASHES = /[—–]/g;

// Rule 2: vocabulary that reads as generated on sight. Deliberately short. A long
// banlist just teaches the next writer to paraphrase around it, and the corpus is
// already clean of the obvious ones, so this exists to keep it that way.
const BANNED_PHRASES: RegExp[] = [
  /\bdelve\b/i,
  /\btapestry\b/i,
  /\bmultifaceted\b/i,
  /\bit'?s worth noting\b/i,
  /\bit is worth noting\b/i,
  /\bin essence\b/i,
  /\bat its core\b/i,
  /\bat its heart\b/i,
  /\bsimply put\b/i,
  /\bput simply\b/i,
  /\bneedless to say\b/i,
  /\bin today'?s world\b/i,
  /\bplays a (?:crucial|vital|key|pivotal) role\b/i,
  /\bnot (?:just|merely|simply) [^.]{1,40}, but\b/i,
];

// Rule 3: one spelling standard. American throughout, so the British forms are the
// leak to catch. Word-boundary anchored on the British form, since the American form
// is what we want to keep.
//
// The -ise/-ize split is the bulk of it, but note that a plain -ize rule would be
// wrong in both directions: "analysis", "organism", "premise" and "exercise" are
// spelled the same either way, and "advertise", "compromise" and "supervise" are -ise
// in American English too. So this is an explicit list rather than a suffix rule.
const BRITICISMS: RegExp[] = [
  /\bcolours?\b/i,
  /\bcoloured\b/i,
  /\bcolouring\b/i,
  /\bbehaviours?\b/i,
  /\bfavour(?:s|ed|ing|able)?\b/i,
  /\blabell(?:ed|ing)\b/i,
  /\bmodell(?:ed|ing)\b/i,
  /\bcentres?\b/i,
  /\bcentred\b/i,
  /\banalys(?:e|es|ed|ing|er)\b/i,
  /\borganis(?:e|es|ed|ing|ation)\b/i,
  /\brecognis(?:e|es|ed|ing)\b/i,
  /\btravell(?:ed|ing)\b/i,
  /\bmetres?\b/i,
  /\bkilometres?\b/i,
  /\bcentimetres?\b/i,
  /\blitres?\b/i,
  /\bdefence\b/i,
  /\boffence\b/i,
  /\blicence\b/i,
  /\bfulfil\b/i,
  /\bneighbour(?:s|ing|hood)?\b/i,
  /\barmour(?:s|ed|ing)?\b/i,
  /\bvapour\b/i,
  /\blabour\b/i,
  /\bgrey(?:scale)?\b/i,
  /\bageing\b/i,
  /\bjudgement\b/i,
  /\bprogramme\b/i,
  /\bpractis(?:e|ed|ing)\b/i,
  /\bsceptic(?:al|ism)?\b/i,
  /\bmanoeuvres?\b/i,
  /\bfinalis(?:e|es|ed|ing)\b/i,
  /\brandomis(?:e|es|ed|ing|ation)\b/i,
  /\bgeneralis(?:e|es|ed|ing|ation)\b/i,
  /\bsynchronis(?:e|es|ed|ing|ation)\b/i,
  /\bmaximis(?:e|es|ed|ing)\b/i,
  /\bminimis(?:e|es|ed|ing)\b/i,
  /\bspecialis(?:e|es|ed|ing)\b/i,
  /\bnormalis(?:e|es|ed|ing)\b/i,
  /\boptimis(?:e|es|ed|ing|ation|ations)\b/i,
  /\boxidis(?:e|es|ed|ing)\b/i,
  /\bpenalis(?:e|es|ed|ing)\b/i,
  /\bpolaris(?:e|es|ed|ing|ation)\b/i,
  /\bionis(?:e|es|ed|ing|ation)\b/i,
  /\bcrystallis(?:e|es|ed|ing|ation)\b/i,
  /\bpolymeris(?:e|es|ed|ing)\b/i,
  /\bdepolaris(?:e|es|ed|ing)\b/i,
  /\bneutralis(?:e|es|ed|ing)\b/i,
  /\bsanitis(?:e|es|ed|ing)\b/i,
  /\blocalis(?:e|es|ed|ing)\b/i,
  /\bfertilis(?:e|es|ed|ing|ation)\b/i,
  /\bparameteris(?:e|es|ed|ing)\b/i,
  /\bcancell(?:ed|ing)\b/i,
  /\bsignall(?:ed|ing)\b/i,
];

// Rule 4: characters allowed beyond ASCII. Maths needs a few symbols, and a few
// names and currencies need accents. Anything outside this set is almost always an
// accident of paste (a smart quote, a stray minus sign) rather than a choice, so
// the check is an allowlist and new entries should be added deliberately.
const ALLOWED_NON_ASCII = new Set(
  [
    "²", "³", "⁴", "½", "¼", "×", "÷", "±", "≈", "≤", "≥", "≠", "√", "∞", "∑", "→",
    "°", "µ", "Δ", "π", "λ", "ω", "β", "α", "θ", "σ", "ħ", "′", "″",
    "£", "€", "¥", "ö", "ő", "é", "è", "ü", "ä", "ñ", "å", "ø", "ç", "í", "á",
  ],
);

/** Body length. The failure this catches is 230 cards all written to the ceiling. */
const LENGTH_MEAN_MAX = 76;
const LENGTH_SHORT_CEILING = 65;
const LENGTH_SHORT_MIN_SHARE = 0.2;

/** Openers. Catches a file where most titles start "Why" and most prompts "Why does". */
const TITLE_OPENER_MAX_SHARE = 0.25;
const PROMPT_OPENER_MAX_SHARE = 0.15;

/** Sources. Catches a corpus whose citations are all one host and therefore decorative. */
const SOURCE_HOST_MAX_SHARE = 0.8;

/** Difficulty. Catches a file that is entirely difficulty 2 with no on-ramp. */
const DIFFICULTY_MIN_SHARE = 0.15;

function checkFile(file: string, cards: Card[]): void {
  const n = cards.length;
  if (n === 0) return;

  for (const c of cards) {
    const text = prose(c);

    const dashes = text.match(DASHES);
    if (dashes) note(file, "dash", `${c.id}: contains ${dashes.length} em/en dash(es)`);

    for (const re of BANNED_PHRASES) {
      const m = text.match(re);
      if (m) note(file, "phrase", `${c.id}: banned phrase "${m[0]}"`);
    }

    for (const re of BRITICISMS) {
      const m = text.match(re);
      if (m) note(file, "spelling", `${c.id}: British spelling "${m[0]}", use American`);
    }

    // Em and en dashes are excluded here because the dash rule above already reports
    // them, and one problem should produce one message.
    const stray = [...new Set([...text].filter((ch) => ch.charCodeAt(0) > 127))].filter(
      (ch) => !ALLOWED_NON_ASCII.has(ch) && !"—–".includes(ch),
    );
    if (stray.length > 0)
      note(file, "unicode", `${c.id}: disallowed character(s) ${stray.map((s) => JSON.stringify(s)).join(", ")}`);
  }

  // Body length distribution.
  const lengths = cards.map((c) => words(c.body).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / n;
  if (mean > LENGTH_MEAN_MAX)
    note(file, "length", `mean body is ${mean.toFixed(1)} words, must be <= ${LENGTH_MEAN_MAX}`);
  const shortCount = lengths.filter((w) => w <= LENGTH_SHORT_CEILING).length;
  if (shortCount / n < LENGTH_SHORT_MIN_SHARE)
    note(
      file,
      "length",
      `only ${pct(shortCount, n)} of bodies are <= ${LENGTH_SHORT_CEILING} words, need >= ${pct(LENGTH_SHORT_MIN_SHARE * n, n)}`,
    );

  // Opener variety.
  const titleOpeners = new Map<string, number>();
  const promptOpeners = new Map<string, number>();
  for (const c of cards) {
    const t = words(c.title)[0].toLowerCase().replace(/[^a-z']/g, "");
    titleOpeners.set(t, (titleOpeners.get(t) ?? 0) + 1);
    const p = words(c.prompt).slice(0, 2).join(" ").toLowerCase().replace(/[^a-z' ]/g, "");
    promptOpeners.set(p, (promptOpeners.get(p) ?? 0) + 1);
  }
  for (const [opener, count] of titleOpeners)
    if (count / n > TITLE_OPENER_MAX_SHARE)
      note(file, "opener", `${count} titles (${pct(count, n)}) start with "${opener}", max ${pct(TITLE_OPENER_MAX_SHARE * n, n)}`);
  for (const [opener, count] of promptOpeners)
    if (count / n > PROMPT_OPENER_MAX_SHARE)
      note(file, "opener", `${count} prompts (${pct(count, n)}) start with "${opener}", max ${pct(PROMPT_OPENER_MAX_SHARE * n, n)}`);

  // Difficulty spread.
  for (const d of [1, 2, 3] as const) {
    const count = cards.filter((c) => c.difficulty === d).length;
    if (count / n < DIFFICULTY_MIN_SHARE)
      note(file, "difficulty", `only ${count} cards (${pct(count, n)}) at difficulty ${d}, need >= ${pct(DIFFICULTY_MIN_SHARE * n, n)}`);
  }

  // Source variety, measured per file so one domain cannot hide behind another.
  const hosts = new Map<string, number>();
  let total = 0;
  for (const c of cards)
    for (const s of c.sources) {
      const host = s.replace(/^https:\/\/([^/]+).*$/, "$1");
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
      total += 1;
    }
  for (const [host, count] of hosts)
    if (total > 0 && count / total > SOURCE_HOST_MAX_SHARE)
      note(file, "sources", `${count} of ${total} sources (${pct(count, total)}) are ${host}, max ${pct(SOURCE_HOST_MAX_SHARE * total, total)}`);
}

for (const domain of DOMAINS) {
  const name = `${domain}.json`;
  const cards = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "corpus", name), "utf8"),
  ) as Card[];
  checkFile(name, cards);
}

const byFile = new Map<string, Failure[]>();
for (const f of failures) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);

for (const domain of DOMAINS) {
  const name = `${domain}.json`;
  const fs_ = byFile.get(name) ?? [];
  console.log(`${name}: ${fs_.length === 0 ? "clean" : `${fs_.length} style issue(s)`}`);
  for (const f of fs_) console.log(`  [${f.rule}] ${f.detail}`);
}

process.exit(failures.length > 0 ? 1 : 0);
