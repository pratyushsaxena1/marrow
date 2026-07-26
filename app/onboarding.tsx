import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { openStore } from "../src/store";
import { loadCorpus } from "../src/corpus";
import { useLayout } from "../src/ui/layout";

type Panel = { kicker: string; title: string; body: string };

// Three panels, one per surface a reviewer or a new user needs to know exists: the
// feed, the scheduler behind it, and the tools built on top of both.
const panels = (count: number): Panel[] => [
  {
    kicker: "Welcome to Marrow",
    title: "Scroll to learn one idea at a time",
    body: `A vertical feed of ${count} bite-size concepts across Computer Science, Finance, Math, and Science. Swipe up for the next idea.`,
  },
  {
    kicker: "How Marrow works",
    title: "Remembered right before you'd forget",
    body: "Marrow remembers what you've seen and brings each idea back right before you'd forget it. Grade how well you knew it, and the ones you find hard come back sooner.",
  },
  {
    kicker: "More than a feed",
    title: "Search, quiz, and track what sticks",
    body: "Browse or search the whole library, save concepts to come back to, run a focused quiz on what you are closest to forgetting, and watch your streak and recall accuracy build in Progress.",
  },
];

/** Progress dots. The active dot is brightened and widened so the current panel reads
 *  at a glance on the dark background. */
function Dots({ active, count }: { active: number; count: number }) {
  return (
    <View className="flex-row gap-2">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={
            i === active
              ? "h-2 w-6 rounded-full bg-neutral-100"
              : "h-2 w-2 rounded-full bg-neutral-700"
          }
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, column } = useLayout();
  const store = useMemo(() => openStore(), []);
  const PANELS = useMemo(() => panels(loadCorpus().length), []);
  const [panel, setPanel] = useState(0);

  const isLast = panel === PANELS.length - 1;

  // Mark onboarding complete so the first-run gate never shows it again, then hand off
  // to the feed.
  const finish = () => {
    store.putSetting("onboardingDone", "1");
    router.replace("/");
  };

  const current = PANELS[panel];

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: gutter,
      }}
    >
      <View className="flex-1 justify-center" style={column}>
        <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
          {current.kicker}
        </Text>
        <Text className="text-neutral-100 text-4xl font-semibold leading-tight mb-5">
          {current.title}
        </Text>
        <Text className="text-neutral-300 text-lg leading-relaxed">{current.body}</Text>
      </View>

      <View className="pb-2" style={column}>
        <View className="items-center mb-8">
          <Dots active={panel} count={PANELS.length} />
        </View>

        <Pressable
          onPress={() => (isLast ? finish() : setPanel((p) => p + 1))}
          className="bg-neutral-100 rounded-2xl py-4 items-center"
        >
          <Text className="text-neutral-900 text-base font-medium">
            {isLast ? "Start learning" : "Next"}
          </Text>
        </Pressable>

        {isLast ? null : (
          <Pressable onPress={finish} className="py-4 items-center mt-2">
            <Text className="text-neutral-500 text-base font-medium">Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
