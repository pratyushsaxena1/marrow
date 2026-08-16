import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { openStore } from "../src/store";
import { loadCorpus } from "../src/corpus";
import { Chip } from "../src/ui/Chip";
import { Icon } from "../src/ui/Icon";
import { ScreenHeader } from "../src/ui/ScreenHeader";
import { SectionLabel } from "../src/ui/SectionLabel";
import { COLORS } from "../src/ui/theme";
import { tick, warn } from "../src/ui/haptics";
import { useLayout } from "../src/ui/layout";
import {
  DAILY_GOAL_DEFAULT, DAILY_GOAL_OPTIONS, LEVELS, LEVEL_LABELS,
} from "../src/constants";
import { loadSelectedLevels } from "../src/format";
import type { Level } from "../src/types";

const SUPPORT_URL = "https://pratyushsaxena1.github.io/marrow/support.html";
const PRIVACY_URL = "https://pratyushsaxena1.github.io/marrow/privacy.html";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, column } = useLayout();

  const store = useMemo(() => openStore(), []);
  const total = useMemo(() => loadCorpus().length, []);

  const [goal, setGoal] = useState<number>(() => {
    const raw = Number(store.getSetting("dailyGoal"));
    return Number.isFinite(raw) && raw > 0 ? raw : DAILY_GOAL_DEFAULT;
  });
  const [savedCount, setSavedCount] = useState(() => store.getBookmarks().length);
  const [levels, setLevels] = useState<Level[]>(() =>
    loadSelectedLevels(store.getSetting("selectedLevels")),
  );

  const chooseGoal = (n: number) => {
    store.putSetting("dailyGoal", String(n));
    setGoal(n);
  };

  const toggleLevel = (l: Level) => {
    const next = levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l];
    // Covering all three means the same as choosing none: every level.
    const canonical = next.length === LEVELS.length ? [] : next;
    store.putSetting("selectedLevels", JSON.stringify(canonical));
    setLevels(canonical);
  };

  const confirmReset = () => {
    warn();
    Alert.alert(
      "Reset progress?",
      "This clears every card's review schedule and your review history. Saved cards and this screen's settings are kept. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            store.reset();
            Alert.alert("Progress reset", "Every concept is new again.");
          },
        },
      ],
    );
  };

  const replayOnboarding = () => {
    store.putSetting("onboardingDone", "0");
    router.replace("/onboarding");
  };

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Nothing useful to say if the browser will not open; leave the user in place.
    });
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 48 }}
      >
        <View style={column}>
          <ScreenHeader title="Settings" onBack={() => router.back()} />

          <SectionLabel>Level</SectionLabel>
          <Text className="text-neutral-400 text-sm leading-relaxed mb-4">
            Which levels the feed draws from. With none chosen you see every level. The
            Library always searches everything.
          </Text>
          <View className="flex-row gap-2 mb-10">
            {LEVELS.map((l) => (
              <Chip
                key={l}
                label={LEVEL_LABELS[l]}
                selected={levels.includes(l)}
                onPress={() => toggleLevel(l)}
              />
            ))}
          </View>

          <SectionLabel>Daily review goal</SectionLabel>
          <Text className="text-neutral-400 text-sm leading-relaxed mb-4">
            The target the Progress screen measures each day against. It does not limit how
            much you can review.
          </Text>
          <View className="flex-row gap-2 mb-10">
            {DAILY_GOAL_OPTIONS.map((n) => (
              <Chip key={n} label={String(n)} selected={goal === n} onPress={() => chooseGoal(n)} />
            ))}
          </View>

          <SectionLabel>Library</SectionLabel>
          <View className="bg-neutral-900 rounded-3xl px-5 py-4 mb-10">
            <Row label="Concepts available" value={String(total)} />
            <Row label="Saved cards" value={String(savedCount)} />
          </View>

          <SectionLabel>Learning data</SectionLabel>
          <ActionRow label="Replay the intro" onPress={replayOnboarding} />
          <ActionRow
            label="Clear saved cards"
            disabled={savedCount === 0}
            onPress={() => {
              Alert.alert("Clear saved cards?", "Your review progress is not affected.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: () => {
                    for (const id of store.getBookmarks()) store.toggleBookmark(id, Date.now());
                    setSavedCount(0);
                  },
                },
              ]);
            }}
          />
          <ActionRow label="Reset all progress" destructive onPress={confirmReset} />

          <SectionLabel className="mt-10 mb-3">About</SectionLabel>
          <ActionRow label="Support" onPress={() => open(SUPPORT_URL)} />
          <ActionRow label="Privacy policy" onPress={() => open(PRIVACY_URL)} />

          <Text className="text-neutral-600 text-xs mt-8 leading-relaxed">
            {`Marrow ${version}. Everything you read, save and review stays on this device. Marrow has no account, no network requests and collects no data.`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-neutral-300 text-base">{label}</Text>
      <Text className="text-neutral-100 text-base font-medium">{value}</Text>
    </View>
  );
}

/** A row that does something when tapped. The trailing chevron is what separates these
 *  from the read-only rows above them, which otherwise look identical. Destructive rows
 *  drop the chevron: red already says enough, and a chevron reads as "go somewhere". */
function ActionRow(
  { label, onPress, destructive, disabled }:
  { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean },
) {
  const tone = disabled
    ? "text-neutral-600"
    : destructive
      ? "text-red-400"
      : "text-neutral-100";
  return (
    <Pressable
      onPress={() => {
        if (!destructive) tick();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      className="flex-row items-center justify-between py-4 border-b border-neutral-900 active:opacity-60"
    >
      <Text className={`text-base ${tone}`}>{label}</Text>
      {destructive || disabled ? null : (
        <Icon name="chevron-right" size={13} color={COLORS.textDim} />
      )}
    </Pressable>
  );
}
