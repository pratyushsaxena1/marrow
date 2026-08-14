import * as Haptics from "expo-haptics";

/** Every haptic in the app goes through this file, so the vocabulary stays small and
 *  consistent: a tick for choosing something, a knock for committing to it, and a
 *  success pattern reserved for a genuine milestone.
 *
 *  Each call is fire-and-forget. The taptic engine is absent on a simulator and on some
 *  hardware, where these reject; a missing buzz is never worth an error, so the promise
 *  is swallowed rather than surfaced. */

/** Choosing among options: a filter chip, a tab, a checkbox, revealing an answer. */
export const tick = (): void => {
  void Haptics.selectionAsync().catch(() => {});
};

/** Committing: grading a card, applying a filter, saving. */
export const knock = (): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** A milestone worth feeling: finishing a quiz, meeting the daily goal. */
export const celebrate = (): void => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Something refused: a destructive confirmation, an action that cannot proceed. */
export const warn = (): void => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};
