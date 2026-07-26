import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getCard, loadCorpus } from "../src/corpus";
import { openStore } from "../src/store";
import { buildQuiz, summarize } from "../src/quiz";
import { initialState, review } from "../src/scheduler";
import { Chip } from "../src/ui/Chip";
import { TabBar, TAB_ROUTES, TAB_BAR_HEIGHT, type TabKey } from "../src/ui/TabBar";
import { useLayout } from "../src/ui/layout";
import {
  DOMAINS,
  DOMAIN_LABELS_SHORT,
  QUIZ_SIZES,
  QUIZ_SIZE_DEFAULT,
} from "../src/constants";
import type { Card, Domain, QuizAnswer } from "../src/types";

const rng = () => Math.random();

type Phase =
  | { name: "setup" }
  | { name: "running"; cards: Card[]; index: number; answers: QuizAnswer[] }
  | { name: "results"; answers: QuizAnswer[] };

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, column } = useLayout();

  const store = useMemo(() => openStore(), []);
  const cards = useMemo(() => loadCorpus(), []);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [size, setSize] = useState<number>(QUIZ_SIZE_DEFAULT);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });

  const toggleDomain = (d: Domain) =>
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  // Draws a fresh run. `only` restricts the pool to specific ids, which is how "Retry
  // missed" reuses the same machinery instead of a parallel code path.
  const start = useCallback(
    (only?: string[]) => {
      const states = new Map(store.getAllStates().map((s) => [s.cardId, s]));
      const pool = only ? cards.filter((c) => only.includes(c.id)) : cards;
      const drawn = buildQuiz(
        { cards: pool, stateOf: (id) => states.get(id), now: Date.now(), rng },
        { size: only ? only.length : size, domains: only ? [] : domains },
      );
      if (drawn.length === 0) return;
      setPhase({ name: "running", cards: drawn, index: 0, answers: [] });
    },
    [cards, domains, size, store],
  );

  const answer = useCallback(
    (card: Card, grade: QuizAnswer["grade"]) => {
      const now = Date.now();
      const prev = store.getState(card.id) ?? initialState(card.id, now, rng);
      store.putState(review(prev, grade, now, rng));
      store.logReview({ cardId: card.id, grade, at: now });

      setPhase((p) => {
        if (p.name !== "running") return p;
        const answers = [...p.answers, { cardId: card.id, grade }];
        return p.index + 1 >= p.cards.length
          ? { name: "results", answers }
          : { name: "running", cards: p.cards, index: p.index + 1, answers };
      });
    },
    [store],
  );

  const available = useMemo(
    () =>
      cards.filter((c) => domains.length === 0 || domains.includes(c.domain)).length,
    [cards, domains],
  );

  const body =
    phase.name === "setup" ? (
      <Setup
        domains={domains}
        size={size}
        available={available}
        onToggleDomain={toggleDomain}
        onSetSize={setSize}
        onStart={() => start()}
      />
    ) : phase.name === "running" ? (
      <Running
        // Remounting per question resets the reveal state, so question 4 can never
        // open already showing its answer.
        key={phase.cards[phase.index].id}
        card={phase.cards[phase.index]}
        index={phase.index}
        total={phase.cards.length}
        onAnswer={answer}
        onQuit={() =>
          setPhase(
            phase.answers.length > 0
              ? { name: "results", answers: phase.answers }
              : { name: "setup" },
          )
        }
      />
    ) : (
      <Results
        answers={phase.answers}
        onRetryMissed={(ids) => start(ids)}
        onNewQuiz={() => setPhase({ name: "setup" })}
        onOpenCard={(id) => router.push(`/card/${id}`)}
      />
    );

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={column}>{body}</View>
      </ScrollView>

      <View style={{ height: TAB_BAR_HEIGHT }}>
        <TabBar
          active="quiz"
          onSelect={(t: TabKey) => {
            if (t !== "quiz") router.replace(TAB_ROUTES[t]);
          }}
        />
      </View>
    </View>
  );
}

function Setup(
  { domains, size, available, onToggleDomain, onSetSize, onStart }:
  {
    domains: Domain[];
    size: number;
    available: number;
    onToggleDomain: (d: Domain) => void;
    onSetSize: (n: number) => void;
    onStart: () => void;
  },
) {
  return (
    <View>
      <Text className="text-neutral-100 text-3xl font-semibold pt-3 mb-2">Quiz</Text>
      <Text className="text-neutral-400 text-base leading-relaxed mb-8">
        A focused run of questions, drawn from what you are closest to forgetting. Every
        answer updates your schedule, just like the feed.
      </Text>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">Subjects</Text>
      <View className="flex-row flex-wrap gap-2 mb-8">
        {DOMAINS.map((d) => (
          <Chip
            key={d}
            label={DOMAIN_LABELS_SHORT[d]}
            selected={domains.includes(d)}
            onPress={() => onToggleDomain(d)}
          />
        ))}
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">Questions</Text>
      <View className="flex-row gap-2 mb-8">
        {QUIZ_SIZES.map((n) => (
          <Chip key={n} label={String(n)} selected={size === n} onPress={() => onSetSize(n)} />
        ))}
      </View>

      <Text className="text-neutral-500 text-sm mb-4">
        {domains.length === 0
          ? `${available} concepts available across all subjects.`
          : `${available} concepts available in your selection.`}
      </Text>

      <Pressable
        onPress={onStart}
        disabled={available === 0}
        className={
          available === 0
            ? "bg-neutral-800 rounded-2xl py-4 items-center"
            : "bg-neutral-100 rounded-2xl py-4 items-center"
        }
      >
        <Text
          className={
            available === 0
              ? "text-neutral-500 text-base font-medium"
              : "text-neutral-900 text-base font-medium"
          }
        >
          {`Start ${Math.min(size, available)}-question quiz`}
        </Text>
      </Pressable>
    </View>
  );
}

function Running(
  { card, index, total, onAnswer, onQuit }:
  {
    card: Card;
    index: number;
    total: number;
    onAnswer: (card: Card, grade: QuizAnswer["grade"]) => void;
    onQuit: () => void;
  },
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View>
      <View className="flex-row items-center justify-between pt-3 mb-3">
        <Text className="text-neutral-400 text-sm font-medium">{`Question ${index + 1} of ${total}`}</Text>
        <Pressable onPress={onQuit} hitSlop={10}>
          <Text className="text-neutral-500 text-sm font-medium">End quiz</Text>
        </Pressable>
      </View>

      <View className="h-1.5 rounded-full bg-neutral-900 overflow-hidden mb-8">
        <View
          className="h-1.5 rounded-full bg-neutral-100"
          style={{ width: `${Math.round((index / total) * 100)}%` }}
        />
      </View>

      <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">{card.topic}</Text>
      <Text className="text-neutral-100 text-2xl font-medium leading-snug mb-2">{card.prompt}</Text>

      {revealed ? (
        <View>
          <Text className="text-neutral-400 text-lg leading-relaxed mt-4">{card.answer}</Text>
          <View className="flex-row gap-3 mt-8">
            <Pressable
              onPress={() => onAnswer(card, "missed")}
              className="flex-1 border border-neutral-700 rounded-2xl py-4 items-center"
            >
              <Text className="text-neutral-300 text-base font-medium">Missed it</Text>
            </Pressable>
            <Pressable
              onPress={() => onAnswer(card, "got")}
              className="flex-1 bg-neutral-100 rounded-2xl py-4 items-center"
            >
              <Text className="text-neutral-900 text-base font-medium">Got it</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setRevealed(true)}
          className="border border-neutral-700 rounded-2xl py-4 items-center mt-8"
        >
          <Text className="text-neutral-300 text-base font-medium">Reveal answer</Text>
        </Pressable>
      )}
    </View>
  );
}

function Results(
  { answers, onRetryMissed, onNewQuiz, onOpenCard }:
  {
    answers: QuizAnswer[];
    onRetryMissed: (ids: string[]) => void;
    onNewQuiz: () => void;
    onOpenCard: (id: string) => void;
  },
) {
  const summary = summarize(answers);

  const verdict =
    summary.pct >= 90 ? "Excellent" : summary.pct >= 70 ? "Solid run" : "Worth another pass";

  return (
    <View>
      <Text className="text-neutral-100 text-3xl font-semibold pt-3 mb-8">{verdict}</Text>

      <View className="bg-neutral-900 rounded-3xl p-6 items-center mb-8">
        <Text className="text-neutral-100 text-6xl font-semibold">{`${summary.pct}%`}</Text>
        <Text className="text-neutral-400 text-base mt-2">
          {`${summary.correct} of ${summary.total} correct`}
        </Text>
      </View>

      {summary.missed.length > 0 ? (
        <>
          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-3">
            Worth revisiting
          </Text>
          <View className="mb-8">
            {summary.missed.map((id) => {
              const card = getCard(id);
              if (!card) return null;
              return (
                <Pressable
                  key={id}
                  onPress={() => onOpenCard(id)}
                  className="py-3.5 border-b border-neutral-900 active:opacity-60"
                >
                  <Text className="text-neutral-500 text-[11px] uppercase tracking-widest mb-1">
                    {card.topic}
                  </Text>
                  <Text className="text-neutral-200 text-base leading-snug" numberOfLines={2}>
                    {card.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onRetryMissed(summary.missed)}
            className="bg-neutral-100 rounded-2xl py-4 items-center mb-3"
          >
            <Text className="text-neutral-900 text-base font-medium">
              {`Retry ${summary.missed.length} missed`}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text className="text-neutral-400 text-base leading-relaxed mb-8">
          Every answer correct. Those cards move further out in your schedule.
        </Text>
      )}

      <Pressable
        onPress={onNewQuiz}
        className="border border-neutral-700 rounded-2xl py-4 items-center"
      >
        <Text className="text-neutral-300 text-base font-medium">New quiz</Text>
      </Pressable>
    </View>
  );
}
