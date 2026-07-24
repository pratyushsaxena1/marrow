import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { openStore } from "../src/store";

// A 2-dot progress indicator. The active dot is brightened and widened so the
// current panel reads at a glance on the dark background.
function Dots({ active }: { active: number }) {
  return (
    <View className="flex-row gap-2">
      {[0, 1].map((i) => (
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
  const store = useMemo(() => openStore(), []);
  const [panel, setPanel] = useState<0 | 1>(0);

  // Mark onboarding complete so the first-run gate never shows it again, then
  // hand off to the feed.
  const finish = () => {
    store.putSetting("onboardingDone", "1");
    router.replace("/");
  };

  return (
    <View
      className="flex-1 bg-neutral-950 px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 justify-center">
        {panel === 0 ? (
          <>
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
              Welcome to Marrow
            </Text>
            <Text className="text-neutral-100 text-4xl font-semibold leading-tight mb-5">
              Scroll to learn one idea at a time
            </Text>
            <Text className="text-neutral-300 text-lg leading-relaxed">
              A vertical feed of bite-size concepts across Computer Science, Finance,
              Math, and Science. Swipe up for the next idea.
            </Text>
          </>
        ) : (
          <>
            <Text className="text-neutral-500 text-xs uppercase tracking-widest mb-4">
              How Marrow works
            </Text>
            <Text className="text-neutral-100 text-4xl font-semibold leading-tight mb-5">
              Remembered right before you'd forget
            </Text>
            <Text className="text-neutral-300 text-lg leading-relaxed">
              Marrow remembers what you've seen and brings each idea back right before
              you'd forget it. Grade how well you knew it, and the ones you find hard
              come back sooner.
            </Text>
          </>
        )}
      </View>

      <View className="pb-2">
        <View className="items-center mb-8">
          <Dots active={panel} />
        </View>

        {panel === 0 ? (
          <>
            <Pressable
              onPress={() => setPanel(1)}
              className="bg-neutral-100 rounded-2xl py-4 items-center"
            >
              <Text className="text-neutral-900 text-base font-medium">Next</Text>
            </Pressable>
            <Pressable onPress={finish} className="py-4 items-center mt-2">
              <Text className="text-neutral-500 text-base font-medium">Skip</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={finish}
            className="bg-neutral-100 rounded-2xl py-4 items-center"
          >
            <Text className="text-neutral-900 text-base font-medium">Start learning</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
