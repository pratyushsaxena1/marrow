import React, { useState } from "react";
import { Text, View } from "react-native";
import { CardShell } from "./CardShell";
import { CardActions } from "./CardActions";
import { GradeButtons } from "./GradeButtons";
import { Button } from "./Button";
import { FadeIn } from "./FadeIn";
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
      // Revealing can push the answer past the bottom of the page on a long card; the
      // shell scrolls down to it so the reveal is never invisible.
      scrollSignal={revealed ? 1 : 0}
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
          <FadeIn>
            <Text className="text-neutral-400 text-lg leading-relaxed mt-6">{card.answer}</Text>
          </FadeIn>
          <GradeButtons onGrade={handleGrade} graded={graded} />
        </View>
      ) : (
        <Button
          label="Reveal"
          variant="secondary"
          haptic="tick"
          onPress={() => setRevealed(true)}
          style={{ marginTop: 32 }}
        />
      )}
    </CardShell>
  );
}
