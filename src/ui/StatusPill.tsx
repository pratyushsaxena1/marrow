import React from "react";
import { Text, View } from "react-native";
import type { CardStatus } from "../types";

// "Due" is not a CardStatus: a card is due *and* learning or mastered at the same time.
// Because being due is the most actionable thing about a card, it wins the pill.
export type PillKind = CardStatus | "due";

// Three greys and one accent, ordered by how much attention each deserves. Due is the
// only state asking for action, so it gets the solid white pill; mastered is the only
// state worth celebrating, so it gets the accent; new and learning are quiet greys
// that differ in weight rather than hue.
const STYLES: Record<PillKind, { label: string; box: string; text: string }> = {
  new: { label: "New", box: "bg-neutral-900", text: "text-neutral-500" },
  learning: { label: "Learning", box: "bg-neutral-800", text: "text-neutral-300" },
  mastered: { label: "Mastered", box: "bg-emerald-400/10", text: "text-emerald-400" },
  due: { label: "Due now", box: "bg-neutral-100", text: "text-neutral-900" },
};

export function StatusPill({ kind }: { kind: PillKind }) {
  const s = STYLES[kind];
  return (
    <View className={`px-2 py-0.5 rounded-full ${s.box}`}>
      <Text className={`text-[11px] font-medium ${s.text}`}>{s.label}</Text>
    </View>
  );
}

/** Picks the pill a card should show: due outranks its learning status. */
export const pillFor = (status: CardStatus, isDue: boolean): PillKind =>
  isDue && status !== "new" ? "due" : status;
