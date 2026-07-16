import React from "react";
import { Text } from "react-native";
import { CardShell } from "./CardShell";
import type { Card } from "../types";

export function ConceptCard({ card, height }: { card: Card; height: number }) {
  return (
    <CardShell height={height} domain={card.domain}>
      <Text className="text-neutral-100 text-3xl font-semibold leading-tight mb-5">
        {card.title}
      </Text>
      <Text className="text-neutral-300 text-lg leading-relaxed">{card.body}</Text>
    </CardShell>
  );
}
