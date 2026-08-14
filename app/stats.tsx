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
import { SectionLabel } from "../src/ui/SectionLabel";
import { Icon } from "../src/ui/Icon";
import { COLORS } from "../src/ui/theme";
// Aliased: this screen already has a `tick` of its own, the focus-refresh counter.
import { tick as hapticTick } from "../src/ui/haptics";
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
            <Pressable
              onPress={() => {
                hapticTick();
                router.push("/settings");
              }}
              hitSlop={10}
              accessibilityRole="button"
              className="flex-row items-center gap-1 py-1 pl-3 active:opacity-60"
            >
              <Text className="text-neutral-400 text-sm font-medium">Settings</Text>
              <Icon name="chevron-right" size={12} color={COLORS.textFaint} />
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
            {isWide ? <StatTile label="Mastered" value={data.stats.mastered} accent /> : null}
            {isWide ? <StatTile label="Due now" value={data.stats.dueToday} /> : null}
          </View>

          <View className="flex-row gap-3 mb-10">
            {isWide ? null : <StatTile label="Mastered" value={data.stats.mastered} accent />}
            {isWide ? null : <StatTile label="Due now" value={data.stats.dueToday} />}
            {isWide ? <StatTile label="Recall accuracy" value={accuracyValue} /> : null}
            {isWide ? <StatTile label="Reviews logged" value={data.accuracy.reviews} /> : null}
          </View>

          <SectionLabel className="mb-4">{`Last ${ACTIVITY_DAYS} days`}</SectionLabel>
          <ActivityChart buckets={data.buckets} />

          {isWide ? null : (
            <View className="flex-row gap-3 mb-10">
              <StatTile label="Recall accuracy" value={accuracyValue} />
              <StatTile label="Reviews logged" value={data.accuracy.reviews} />
            </View>
          )}

          <SectionLabel className="mb-4">By subject</SectionLabel>
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

// A day is one cell, a week one row, so four weeks make a block the eye can take in at
// once. The window ends today, in the bottom-right corner.
//
// This replaces a row of 28 thin bars. Bars encode magnitude against a baseline, which
// needs height to read; at 28 columns each was a few points wide, and on the ordinary
// week where most days are zero the chart collapsed into a dotted line that looked
// broken rather than quiet. A grid encodes the same magnitude as intensity, so an empty
// stretch still reads as a filled calendar with nothing in it.
const WEEK_LENGTH = 7;

// Cells are wider than they are tall rather than square. A square cell across a phone's
// full column is over 40pt, which makes four weeks taller than everything above it and
// turns a summary into the centrepiece of the screen. This keeps the block roughly a
// third of that height while still filling the column.
const CELL_HEIGHT = 26;

// One hue, four steps, darkest to lightest, over the page background. Zero is a
// neutral so "no reviews" never looks like the bottom of the accent ramp.
const EMPTY_CELL = "#1a1a1a";
const LEVELS = ["rgba(52,211,153,0.28)", "rgba(52,211,153,0.5)", "rgba(52,211,153,0.75)", COLORS.accent];

/** Which of the four steps a day's count lands on, measured against the busiest day in
 *  the window. Relative rather than absolute: ten reviews is a heavy day for one person
 *  and a light one for another, and either way the busiest day should be the brightest. */
function levelFor(count: number, peak: number): string | null {
  if (count === 0) return null;
  const step = Math.ceil((count / peak) * LEVELS.length);
  return LEVELS[Math.min(LEVELS.length, Math.max(1, step)) - 1];
}

function ActivityChart({ buckets }: { buckets: DayBucket[] }) {
  const peak = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const weeks: DayBucket[][] = [];
  for (let i = 0; i < buckets.length; i += WEEK_LENGTH) {
    weeks.push(buckets.slice(i, i + WEEK_LENGTH));
  }

  return (
    <View className="mb-10">
      {/* The window does not start on a fixed weekday, so the column headings are read
          off the first week's own dates rather than assumed. */}
      <View className="flex-row gap-1.5 mb-1.5">
        {buckets.slice(0, WEEK_LENGTH).map((b) => (
          <View key={b.dayStart} className="flex-1 items-center">
            <Text className="text-neutral-600 text-[10px]">{weekdayInitial(b.dayStart)}</Text>
          </View>
        ))}
      </View>

      <View
        className="gap-1.5"
        accessibilityLabel={`${total} reviews over the last ${buckets.length} days`}
      >
        {weeks.map((week) => (
          <View key={week[0].dayStart} className="flex-row gap-1.5">
            {week.map((day) => (
              <View
                key={day.dayStart}
                style={{
                  flex: 1,
                  height: CELL_HEIGHT,
                  borderRadius: 5,
                  backgroundColor: levelFor(day.count, peak) ?? EMPTY_CELL,
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {peak === 0 ? (
        <Text className="text-neutral-500 text-sm mt-4 leading-relaxed">
          No reviews logged yet. Grade a card in the feed or run a quiz to start the chart.
        </Text>
      ) : (
        <View className="flex-row items-center justify-end gap-1.5 mt-3">
          <Text className="text-neutral-600 text-[10px] mr-0.5">Less</Text>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: EMPTY_CELL }} />
          {LEVELS.map((color) => (
            <View
              key={color}
              style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }}
            />
          ))}
          <Text className="text-neutral-600 text-[10px] ml-0.5">More</Text>
        </View>
      )}
    </View>
  );
}

/** `accent` is spent on the one figure that represents something achieved rather than
 *  something outstanding, so the color keeps its meaning across the app. */
function StatTile(
  { label, value, accent }: { label: string; value: number | string; accent?: boolean },
) {
  return (
    <View className="flex-1 bg-neutral-900 rounded-2xl px-3 py-5 items-center">
      <Text
        className={
          accent && value !== 0
            ? "text-emerald-400 text-3xl font-semibold"
            : "text-neutral-100 text-3xl font-semibold"
        }
      >
        {value}
      </Text>
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
      <View className="h-2 rounded-full bg-neutral-900 overflow-hidden">
        <View
          className={pct >= 100 ? "h-2 rounded-full bg-emerald-400" : "h-2 rounded-full bg-neutral-100"}
          style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
        />
      </View>
    </View>
  );
}
