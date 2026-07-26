import React from "react";
import { Text } from "react-native";
import { CardShell } from "./CardShell";
import { CardActions } from "./CardActions";
import type { Card } from "../types";

export function ConceptCard(
  { card, height, saved, onToggleSave, onOpen }:
  {
    card: Card;
    height: number;
    saved?: boolean;
    onToggleSave?: () => void;
    onOpen?: () => void;
  },
) {
  return (
    <CardShell
      height={height}
      domain={card.domain}
      actions={
        onToggleSave && onOpen ? (
          <CardActions saved={saved ?? false} onToggleSave={onToggleSave} onOpen={onOpen} />
        ) : null
      }
    >
      <Text className="text-neutral-100 text-3xl font-semibold leading-tight mb-5">
        {card.title}
      </Text>
      <Text className="text-neutral-300 text-lg leading-relaxed">{card.body}</Text>
    </CardShell>
  );
}
