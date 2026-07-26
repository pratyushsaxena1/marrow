import React from "react";
import { Text, View } from "react-native";
import type { CardStatus } from "../types";

// "Due" is not a CardStatus: a card is due *and* learning or mastered at the same time.
// Because being due is the most actionable thing about a card, it wins the pill.
export type PillKind = CardStatus | "due";

const STYLES: Record<PillKind, { label: string; box: string; text: string }> = {
  new: { label: "New", box: "bg-neutral-800", text: "text-neutral-400" },
  learning: { label: "Learning", box: "bg-amber-500/15", text: "text-amber-400" },
  mastered: { label: "Mastered", box: "bg-emerald-500/15", text: "text-emerald-400" },
  due: { label: "Due now", box: "bg-sky-500/15", text: "text-sky-400" },
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
