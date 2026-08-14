import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
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
