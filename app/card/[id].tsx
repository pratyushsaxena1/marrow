import React, { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getCard, loadCorpus } from "../../src/corpus";
import { openStore } from "../../src/store";
import { related, statusOf } from "../../src/search";
import { initialState, review } from "../../src/scheduler";
import { difficultyLabel, nextReviewLabel } from "../../src/format";
import { GradeButtons } from "../../src/ui/GradeButtons";
import { SaveButton } from "../../src/ui/SaveButton";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { SectionLabel } from "../../src/ui/SectionLabel";
import { Button, IconButton } from "../../src/ui/Button";
import { FadeIn } from "../../src/ui/FadeIn";
import { Icon } from "../../src/ui/Icon";
import { COLORS } from "../../src/ui/theme";
import { StatusPill, pillFor } from "../../src/ui/StatusPill";
import { useLayout } from "../../src/ui/layout";
import { DOMAIN_LABELS } from "../../src/constants";
import type { CardState, Grade } from "../../src/types";

const rng = () => Math.random();

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, column } = useLayout();

  const store = useMemo(() => openStore(), []);
  const card = useMemo(() => (typeof id === "string" ? getCard(id) : undefined), [id]);

  const [state, setState] = useState<CardState | null>(() =>
    typeof id === "string" ? store.getState(id) : null,
  );
  const [saved, setSaved] = useState(() =>
    typeof id === "string" ? store.getBookmarks().includes(id) : false,
  );
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<Grade | null>(null);

  const neighbours = useMemo(
    () => (card ? related(card, loadCorpus(), 4) : []),
    [card],
  );

  // Tapping the home screen widget cold starts the app straight onto this screen, so
  // there is no stack to pop and a plain back() silently does nothing, stranding the
  // reader on the card. Falling back to the feed gives back a destination in the one
  // case it lacks one, and leaves the ordinary push from the Library or search alone.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  // Grading here writes through the same scheduler and log the feed uses, so practising
  // a card from the Library moves its real schedule rather than being a dry run.
  const onGrade = useCallback(
    (g: Grade) => {
      if (!card || graded !== null) return;
      const now = Date.now();
      const prev = store.getState(card.id) ?? initialState(card.id, now, rng);
      const next = review(prev, g, now, rng);
      store.putState(next);
      store.logReview({ cardId: card.id, grade: g, at: now });
      setState(next);
      setGraded(g);
    },
    [card, graded, store],
  );

  const onShare = useCallback(() => {
    if (!card) return;
    Share.share({
      message: `${card.title}\n\n${card.body}\n\nFrom Marrow`,
    }).catch(() => {
      // A dismissed or unavailable share sheet is not an error worth surfacing.
    });
  }, [card]);

  if (!card) {
    return (
      <View
        className="flex-1 bg-neutral-950 px-6 justify-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text className="text-neutral-100 text-2xl font-semibold mb-3">Concept not found</Text>
        <Text className="text-neutral-400 text-base leading-relaxed mb-8">
          This card is no longer part of the library.
        </Text>
        <Button label="Go back" onPress={goBack} />
      </View>
    );
  }

  const now = Date.now();
  const isDue = state !== null && state.dueAt <= now;

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 48 }}>
        <View style={column}>
          <ScreenHeader
            title={card.topic}
            onBack={goBack}
            right={
              <View className="flex-row items-center -mr-2">
                <IconButton name="share" size={19} onPress={onShare} label="Share" />
                <SaveButton
                  saved={saved}
                  size="lg"
                  onPress={() => setSaved(store.toggleBookmark(card.id, Date.now()))}
                />
              </View>
            }
          />

          <SectionLabel>
            {`${DOMAIN_LABELS[card.domain]} · ${difficultyLabel(card.difficulty)}`}
          </SectionLabel>
          <Text className="text-neutral-100 text-3xl font-semibold leading-tight mb-5">
            {card.title}
          </Text>
          <Text className="text-neutral-300 text-lg leading-relaxed mb-8">{card.body}</Text>

          <View className="bg-neutral-900 rounded-3xl p-5 mb-8">
            <SectionLabel>Test yourself</SectionLabel>
            <Text className="text-neutral-100 text-xl font-medium leading-snug">{card.prompt}</Text>

            {revealed ? (
              <View>
                <FadeIn>
                  <Text className="text-neutral-400 text-base leading-relaxed mt-4">
                    {card.answer}
                  </Text>
                </FadeIn>
                <GradeButtons onGrade={onGrade} graded={graded} />
              </View>
            ) : (
              <Button
                label="Reveal answer"
                variant="secondary"
                haptic="tick"
                onPress={() => setRevealed(true)}
                style={{ marginTop: 20 }}
              />
            )}
          </View>

          <SectionLabel>Your schedule</SectionLabel>
          <View className="bg-neutral-900 rounded-3xl p-5 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <StatusPill kind={pillFor(statusOf(state ?? undefined), isDue)} />
              <Text className="text-neutral-300 text-sm">
                {state ? nextReviewLabel(state.dueAt, now) : "Not started"}
              </Text>
            </View>
            <View className="flex-row">
              <Metric label="Reviews" value={state ? String(state.reps) : "0"} />
              <Metric label="Times missed" value={state ? String(state.lapses) : "0"} />
              <Metric
                label="Interval"
                value={state ? `${Math.max(1, Math.round(state.intervalDays))}d` : "-"}
              />
            </View>
          </View>

          {card.tags.length > 0 ? (
            <>
              <SectionLabel>Tags</SectionLabel>
              <View className="flex-row flex-wrap gap-2 mb-8">
                {card.tags.map((t) => (
                  <View key={t} className="px-3 py-1.5 rounded-full bg-neutral-900">
                    <Text className="text-neutral-400 text-sm">{t}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {card.sources.length > 0 ? (
            <>
              <SectionLabel>Read further</SectionLabel>
              <View className="mb-8">
                {card.sources.map((url) => (
                  <Pressable
                    key={url}
                    onPress={() => {
                      Linking.openURL(url).catch(() => {
                        // A source that will not open is not worth interrupting reading for.
                      });
                    }}
                    accessibilityRole="link"
                    className="flex-row items-center gap-3 py-3.5 border-b border-neutral-900 active:opacity-60"
                  >
                    <Text className="text-neutral-300 text-base flex-1" numberOfLines={1}>
                      {url.replace(/^https:\/\//, "")}
                    </Text>
                    <Icon name="share" size={13} color={COLORS.textDim} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {neighbours.length > 0 ? (
            <>
              <SectionLabel>Related concepts</SectionLabel>
              <View>
                {neighbours.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => router.push(`/card/${n.id}`)}
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 py-3.5 border-b border-neutral-900 active:opacity-60"
                  >
                    <View className="flex-1">
                      <Text className="text-neutral-500 text-[11px] uppercase tracking-widest mb-1">
                        {n.topic}
                      </Text>
                      <Text className="text-neutral-200 text-base leading-snug" numberOfLines={2}>
                        {n.title}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={14} color={COLORS.textDim} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-neutral-100 text-2xl font-semibold">{value}</Text>
      <Text className="text-neutral-500 text-xs mt-0.5">{label}</Text>
    </View>
  );
}
