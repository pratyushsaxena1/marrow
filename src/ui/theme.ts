/** The palette, for the places that need a literal color rather than a Tailwind class:
 *  icon strokes, chart fills, a text input's placeholder. Every value here is the hex
 *  of the Tailwind neutral the classes already use, so the two stay in step.
 *
 *  The scheme is deliberately narrow. Greys carry the whole interface; white is the
 *  emphasis, used for what to act on next; a single accent marks what has been achieved;
 *  red is reserved for destruction. A color in this app should always mean something. */
export const COLORS = {
  /** Page background. neutral-950 */
  bg: "#0a0a0a",
  /** Raised panels: stat tiles, the search field, the sheet. neutral-900 */
  surface: "#171717",
  /** Hairlines and the resting state of a track or bar. neutral-800 */
  border: "#262626",
  /** Primary text, and the fill of a primary button. neutral-100 */
  text: "#f5f5f5",
  /** Secondary text. neutral-400 */
  textMuted: "#a3a3a3",
  /** Labels, captions, placeholders. neutral-500 */
  textFaint: "#737373",
  /** Disabled and decorative strokes. neutral-600 */
  textDim: "#525252",
  /** The resting state of a *solid* icon. A filled shape carries far more ink than a
   *  stroked one, so matching their hex would leave the solid icon shouting over the
   *  outline beside it; this sits a step lower to make them read as equals. */
  iconGhost: "#454545",
  /** The one accent: progress made, goals met, cards mastered. emerald-400 */
  accent: "#34d399",
  /** Destructive actions only. red-400 */
  danger: "#f87171",
} as const;

/** Durations, in ms. Motion in this app is meant to be felt rather than watched: it
 *  confirms that a tap landed, then gets out of the way. */
export const DURATION = {
  /** Press feedback and other state flips. */
  fast: 120,
  /** Content appearing: a revealed answer, a graded confirmation. */
  base: 220,
} as const;
