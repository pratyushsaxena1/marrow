import "../global.css";
import { useEffect, useMemo } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { openStore } from "../src/store";
import { syncWidgetPreferences } from "../src/widget/preferences";

export default function RootLayout() {
  const store = useMemo(() => openStore(), []);

  // Backfills the shared container on launch. An install upgrading from 1.2.0 already
  // has filters chosen, and the widget has never seen them. This lives here rather than
  // in the feed screen because the layout is the only place that runs exactly once per
  // launch: the tab bar navigates with router.replace, which unmounts and remounts the
  // feed on every round trip. The layout also covers a reader who cold starts from the
  // widget straight onto the card detail screen and never mounts the feed at all.
  useEffect(() => {
    syncWidgetPreferences(store);
  }, [store]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a0a" } }}>
        {/* The four tab destinations are siblings in one stack, so moving between them
            would otherwise play the push transition and slide in from the right. A tab
            switch should read as an instant swap, so those screens opt out of it.
            Pushed screens (card detail, settings, onboarding) keep the default slide. */}
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="library" options={{ animation: "none" }} />
        <Stack.Screen name="quiz" options={{ animation: "none" }} />
        <Stack.Screen name="stats" options={{ animation: "none" }} />
      </Stack>
    </>
  );
}
