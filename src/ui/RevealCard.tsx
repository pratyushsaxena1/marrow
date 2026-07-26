import React, { useState } from "react";
import { Text, Pressable, View } from "react-native";
import { CardShell } from "./CardShell";
import { CardActions } from "./CardActions";
import { GradeButtons } from "./GradeButtons";
import type { Card, Grade } from "../types";

export function RevealCard(
  { card, height, showBody, onGrade, saved, onToggleSave, onOpen }:
  {
    card: Card;
    height: number;
    showBody: boolean;
    onGrade: (g: Grade) => void;
    saved?: boolean;
    onToggleSave?: () => void;
    onOpen?: () => void;
  },
) {
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<Grade | null>(null);

  const handleGrade = (g: Grade) => {
    if (graded !== null) return;
    setGraded(g);
    onGrade(g);
  };

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
      {showBody ? (
        <>
          <Text className="text-neutral-100 text-2xl font-semibold leading-tight mb-4">
            {card.title}
          </Text>
          <Text className="text-neutral-300 text-lg leading-relaxed mb-6">{card.body}</Text>
        </>
      ) : null}

      <Text className="text-neutral-100 text-2xl font-medium leading-snug">{card.prompt}</Text>

      {revealed ? (
        <View>
          <Text className="text-neutral-400 text-lg leading-relaxed mt-6">{card.answer}</Text>
          <GradeButtons onGrade={handleGrade} graded={graded} />
        </View>
      ) : (
        <Pressable
          onPress={() => setRevealed(true)}
          className="border border-neutral-700 rounded-2xl py-4 items-center mt-8"
        >
          <Text className="text-neutral-300 text-base font-medium">Reveal</Text>
        </Pressable>
      )}
    </CardShell>
  );
}
