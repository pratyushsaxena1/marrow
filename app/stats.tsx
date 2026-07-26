import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { openStore } from "../src/store";
import { getCard, countByDomain } from "../src/corpus";
import {
  accuracy,
  computeStats,
  currentStreak,
  dailyCounts,
  reviewsToday,
  windowStart,
  type DayBucket,
} from "../src/stats";
import { weekdayInitial } from "../src/format";
import { TabBar, TAB_ROUTES, TAB_BAR_HEIGHT, type TabKey } from "../src/ui/TabBar";
import { useLayout } from "../src/ui/layout";
import { ACTIVITY_DAYS, DAILY_GOAL_DEFAULT, DOMAINS, DOMAIN_LABELS } from "../src/constants";
import type { Domain } from "../src/types";

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, column, isWide } = useLayout();

  const store = useMemo(() => openStore(), []);
  const [tick, setTick] = useState(0);

  // Grading happens on three other screens, so the figures are recomputed whenever this
  // screen is focused rather than once at mount.
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  const data = useMemo(() => {
    const now = Date.now();
    const log = store.getReviewLog(windowStart(now, ACTIVITY_DAYS));
    const goalRaw = Number(store.getSetting("dailyGoal"));
    return {
      now,
      stats: computeStats({
        states: store.getAllStates(),
        now,
        domainOf: (id) => getCard(id)?.domain,
        totals: countByDomain(),
      }),
      buckets: dailyCounts(log, now, ACTIVITY_DAYS),
      streak: currentStreak(log, now),
      today: reviewsToday(log, now),
      goal: Number.isFinite(goalRaw) && goalRaw > 0 ? goalRaw : DAILY_GOAL_DEFAULT,
      accuracy: accuracy(log),
    };
  }, [store, tick]);

  const goalPct = Math.min(100, Math.round((data.today / data.goal) * 100));
  const accuracyValue = data.accuracy.reviews === 0 ? "-" : `${data.accuracy.pct}%`;

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 32 }}
      >
        <View style={column}>
          <View className="flex-row items-end justify-between mb-8">
            <Text className="text-neutral-100 text-3xl font-semibold">Progress</Text>
            <Pressable onPress={() => router.push("/settings")} hitSlop={10} className="py-1 pl-3">
              <Text className="text-neutral-400 text-sm font-medium">Settings</Text>
            </Pressable>
          </View>

          <View className="bg-neutral-900 rounded-3xl p-5 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-neutral-400 text-sm">Today's goal</Text>
              <Text className="text-neutral-100 text-sm font-medium">
                {`${data.today} / ${data.goal} reviews`}
              </Text>
            </View>
            <View className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
              <View
                className={
                  goalPct >= 100
                    ? "h-2.5 rounded-full bg-emerald-400"
                    : "h-2.5 rounded-full bg-neutral-100"
                }
                style={{ width: `${goalPct}%` }}
              />
            </View>
            <Text className="text-neutral-500 text-xs mt-3">
              {data.today >= data.goal
                ? "Goal met. Anything more is a bonus."
                : `${data.goal - data.today} to go.`}
            </Text>
          </View>

          {/* Four tiles fit one row on a tablet; a phone splits them two and two. */}
          <View className="flex-row gap-3 mb-4">
            <StatTile label="Day streak" value={data.streak} />
            <StatTile label="Learned" value={data.stats.learned} />
            {isWide ? <StatTile label="Mastered" value={data.stats.mastered} /> : null}
            {isWide ? <StatTile label="Due now" value={data.stats.dueToday} /> : null}
          </View>

          <View className="flex-row gap-3 mb-10">
            {isWide ? null : <StatTile label="Mastered" value={data.stats.mastered} />}
            {isWide ? null : <StatTile label="Due now" value={data.stats.dueToday} />}
            {isWide ? <StatTile label="Recall accuracy" value={accuracyValue} /> : null}
            {isWide ? <StatTile label="Reviews logged" value={data.accuracy.reviews} /> : null}
          </View>

          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
            {`Last ${ACTIVITY_DAYS} days`}
          </Text>
          <ActivityChart buckets={data.buckets} />

          {isWide ? null : (
            <View className="flex-row gap-3 mb-10">
              <StatTile label="Recall accuracy" value={accuracyValue} />
              <StatTile label="Reviews logged" value={data.accuracy.reviews} />
            </View>
          )}

          <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">By subject</Text>
          {DOMAINS.map((d) => (
            <SubjectRow
              key={d}
              domain={d}
              seen={data.stats.perDomain[d].seen}
              total={data.stats.perDomain[d].total}
            />
          ))}
        </View>
      </ScrollView>

      <View style={{ height: TAB_BAR_HEIGHT }}>
        <TabBar
          active="progress"
          onSelect={(t: TabKey) => {
            if (t !== "progress") router.replace(TAB_ROUTES[t]);
          }}
        />
      </View>
    </View>
  );
}

const CHART_HEIGHT = 72;

// A bar per day, scaled against the busiest day in the window so a quiet stretch still
// reads. Empty days keep a 2pt stub rather than vanishing, which keeps the calendar's
// shape intact and makes gaps visible instead of invisible.
function ActivityChart({ buckets }: { buckets: DayBucket[] }) {
  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  return (
    <View className="mb-10">
      <View style={{ height: CHART_HEIGHT }} className="flex-row items-end gap-[3px]">
        {buckets.map((b) => (
          <View
            key={b.dayStart}
            className={
              b.count > 0 ? "flex-1 rounded-sm bg-neutral-100" : "flex-1 rounded-sm bg-neutral-800"
            }
            style={{ height: peak === 0 ? 2 : Math.max(2, (b.count / peak) * CHART_HEIGHT) }}
          />
        ))}
      </View>
      <View className="flex-row gap-[3px] mt-2">
        {buckets.map((b, i) => (
          <View key={b.dayStart} className="flex-1 items-center">
            <Text className="text-neutral-600 text-[9px]">
              {i % 7 === 0 ? weekdayInitial(b.dayStart) : ""}
            </Text>
          </View>
        ))}
      </View>
      {peak === 0 ? (
        <Text className="text-neutral-500 text-sm mt-3">
          No reviews logged yet. Grade a card in the feed or run a quiz to start the chart.
        </Text>
      ) : null}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 bg-neutral-900 rounded-2xl px-3 py-5 items-center">
      <Text className="text-neutral-100 text-3xl font-semibold">{value}</Text>
      <Text className="text-neutral-500 text-xs mt-1 text-center">{label}</Text>
    </View>
  );
}

function SubjectRow({ domain, seen, total }: { domain: Domain; seen: number; total: number }) {
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-neutral-200 text-base">{DOMAIN_LABELS[domain]}</Text>
        <Text className="text-neutral-500 text-sm">{`${seen} / ${total}`}</Text>
      </View>
      <View className="h-2 rounded-full bg-neutral-800 overflow-hidden">
        <View className="h-2 rounded-full bg-neutral-100" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
