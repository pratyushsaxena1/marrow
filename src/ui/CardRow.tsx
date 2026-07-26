import React from "react";
import { Pressable, Text, View } from "react-native";
import { StatusPill, type PillKind } from "./StatusPill";
import { DOMAIN_LABELS_SHORT } from "../constants";
import type { Card } from "../types";

/** One row in the Library list: subject and topic above, the concept title below, and
 *  the card's learning state on the right. Saved cards get a star so the Library and
 *  the saved filter agree without needing a separate screen. */
export function CardRow(
  { card, pill, saved, onPress }:
  { card: Card; pill: PillKind; saved: boolean; onPress: () => void },
) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="py-4 border-b border-neutral-900 active:opacity-60"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-neutral-500 text-[11px] uppercase tracking-widest mb-1.5">
            {`${DOMAIN_LABELS_SHORT[card.domain]} · ${card.topic}`}
          </Text>
          <Text className="text-neutral-100 text-base leading-snug" numberOfLines={2}>
            {card.title}
          </Text>
        </View>
        <View className="items-end gap-1.5">
          <StatusPill kind={pill} />
          {saved ? <Text className="text-amber-400 text-xs">★</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
