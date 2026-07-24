import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { openStore } from "../src/store";
import { getCard, countByDomain } from "../src/corpus";
import { computeStats } from "../src/stats";
import { DOMAINS, DOMAIN_LABELS } from "../src/constants";
import type { Domain } from "../src/types";

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const store = useMemo(() => openStore(), []);
  const stats = useMemo(
    () =>
      computeStats({
        states: store.getAllStates(),
        now: Date.now(),
        domainOf: (id) => getCard(id)?.domain,
        totals: countByDomain(),
      }),
    [store],
  );

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView contentContainerClassName="px-6 pt-4 pb-10">
        <View className="flex-row items-center justify-between mb-8">
          <Text className="text-neutral-100 text-3xl font-semibold">Your progress</Text>
          <Pressable onPress={() => router.back()} hitSlop={8} className="py-1 pl-3">
            <Text className="text-neutral-400 text-base font-medium">Done</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-3 mb-10">
          <StatTile label="Learned" value={stats.learned} />
          <StatTile label="Mastered" value={stats.mastered} />
          <StatTile label="Due today" value={stats.dueToday} />
        </View>

        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
          By subject
        </Text>
        {DOMAINS.map((d) => (
          <SubjectRow key={d} domain={d} seen={stats.perDomain[d].seen} total={stats.perDomain[d].total} />
        ))}
      </ScrollView>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 bg-neutral-900 rounded-2xl px-4 py-5 items-center">
      <Text className="text-neutral-100 text-4xl font-semibold">{value}</Text>
      <Text className="text-neutral-500 text-xs mt-1 text-center">{label}</Text>
    </View>
  );
}

function SubjectRow(
  { domain, seen, total }: { domain: Domain; seen: number; total: number },
) {
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
