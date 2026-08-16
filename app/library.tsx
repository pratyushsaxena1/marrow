import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { loadCorpus } from "../src/corpus";
import { openStore } from "../src/store";
import { searchCards, statusOf, type Query, type StatusFilter } from "../src/search";
import { CardRow } from "../src/ui/CardRow";
import { Chip } from "../src/ui/Chip";
import { Icon } from "../src/ui/Icon";
import { COLORS } from "../src/ui/theme";
import { tick } from "../src/ui/haptics";
import { pillFor } from "../src/ui/StatusPill";
import { TabBar, TAB_ROUTES, TAB_BAR_HEIGHT, type TabKey } from "../src/ui/TabBar";
import { useLayout } from "../src/ui/layout";
import { DOMAINS, DOMAIN_LABELS_SHORT, LEVELS, LEVEL_LABELS } from "../src/constants";
import type { CardState, Domain, Level } from "../src/types";

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "new", label: "Unread" },
  { key: "learning", label: "Learning" },
  { key: "mastered", label: "Mastered" },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isWide, gutter, column } = useLayout();

  const store = useMemo(() => openStore(), []);
  const cards = useMemo(() => loadCorpus(), []);

  const [text, setText] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [savedOnly, setSavedOnly] = useState(false);

  // Progress and bookmarks change on other screens (grading in the feed, saving on a
  // card), so the snapshot is re-read every time this screen comes back into focus
  // rather than only on mount.
  const [snapshot, setSnapshot] = useState<{ states: Map<string, CardState>; saved: Set<string> }>(
    () => ({ states: new Map(), saved: new Set() }),
  );

  useFocusEffect(
    useCallback(() => {
      setSnapshot({
        states: new Map(store.getAllStates().map((s) => [s.cardId, s])),
        saved: new Set(store.getBookmarks()),
      });
    }, [store]),
  );

  const now = Date.now();
  const query: Query = { text, domains, levels, status, savedOnly };
  const results = useMemo(
    () =>
      searchCards(
        { cards, stateOf: (id) => snapshot.states.get(id), saved: snapshot.saved, now },
        query,
      ),
    // `now` is intentionally excluded: it changes on every render, and re-ranking the
    // list on each keystroke tick would thrash. Focus already refreshes the snapshot.
    [cards, snapshot, text, domains, levels, status, savedOnly], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toggleDomain = (d: Domain) =>
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const toggleLevel = (l: Level) =>
    setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const clearFilters = () => {
    setText("");
    setDomains([]);
    setLevels([]);
    setStatus("all");
    setSavedOnly(false);
  };

  const filtered =
    domains.length > 0 || levels.length > 0 || status !== "all" || savedOnly || text.length > 0;

  // The reading column exists to cap line length for prose. The Library is a list, and
  // on a tablet it runs two-up across the full width, so capping the header and search
  // field would leave them hanging over the left column only. Let them match the list.
  const headerWidth = isWide ? undefined : column;

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View style={{ paddingHorizontal: gutter }}>
        <View style={headerWidth}>
          <View className="flex-row items-end justify-between pt-3 pb-4">
            <Text className="text-neutral-100 text-3xl font-semibold">Library</Text>
            <Pressable
              onPress={() => {
                tick();
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

          <View className="flex-row items-center bg-neutral-900 rounded-2xl px-4 h-12 mb-3">
            <View className="mr-2.5">
              <Icon name="search" size={16} color={COLORS.textFaint} />
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search all concepts"
              placeholderTextColor="#737373"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search all concepts"
              className="flex-1 text-neutral-100 text-base"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>
      </View>

      <View className="mb-1">
        <FlatList
          horizontal
          data={DOMAINS}
          keyExtractor={(d) => d}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }}
          ListHeaderComponent={
            <View className="flex-row gap-2">
              <Chip label="Saved" selected={savedOnly} onPress={() => setSavedOnly((v) => !v)} />
            </View>
          }
          renderItem={({ item }) => (
            <Chip
              label={DOMAIN_LABELS_SHORT[item]}
              selected={domains.includes(item)}
              onPress={() => toggleDomain(item)}
            />
          )}
        />
      </View>

      <View className="mb-2">
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={status === item.key}
              onPress={() => setStatus(item.key)}
            />
          )}
        />
      </View>

      <View className="mb-2">
        <FlatList
          horizontal
          data={LEVELS}
          keyExtractor={(l) => String(l)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Chip
              label={LEVEL_LABELS[item]}
              selected={levels.includes(item)}
              onPress={() => toggleLevel(item)}
            />
          )}
        />
      </View>

      <View style={{ paddingHorizontal: gutter }}>
        <View style={headerWidth} className="flex-row items-center justify-between py-2">
          <Text className="text-neutral-500 text-xs uppercase tracking-widest">
            {`${results.length} of ${cards.length} concepts`}
          </Text>
          {filtered ? (
            <Pressable
              onPress={() => {
                tick();
                clearFilters();
              }}
              hitSlop={8}
              accessibilityRole="button"
              className="active:opacity-60"
            >
              <Text className="text-neutral-400 text-xs font-medium">Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        // numColumns cannot change on a live list, so the key forces a fresh list when
        // the device rotates across the wide/narrow boundary.
        key={isWide ? "grid" : "list"}
        numColumns={isWide ? 2 : 1}
        columnWrapperStyle={isWide ? { gap: 24 } : undefined}
        data={results}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingBottom: 24,
          ...(isWide ? {} : { maxWidth: column.maxWidth, width: "100%", alignSelf: "center" }),
        }}
        renderItem={({ item }) => {
          const state = snapshot.states.get(item.id);
          // maxWidth keeps a lone trailing item half-width instead of stretching it
          // across the whole row.
          return (
            <View style={isWide ? { flex: 1, maxWidth: "50%" } : undefined}>
              <CardRow
                card={item}
                pill={pillFor(statusOf(state), state !== undefined && state.dueAt <= now)}
                saved={snapshot.saved.has(item.id)}
                onPress={() => router.push(`/card/${item.id}`)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-16 px-6">
            <Text className="text-neutral-300 text-lg font-medium mb-2">No matches</Text>
            <Text className="text-neutral-500 text-base text-center leading-relaxed">
              Try a different word, or clear the filters to browse all {cards.length} concepts.
            </Text>
          </View>
        }
      />

      <View style={{ height: TAB_BAR_HEIGHT }}>
        <TabBar
          active="library"
          onSelect={(t: TabKey) => {
            if (t !== "library") router.replace(TAB_ROUTES[t]);
          }}
        />
      </View>
    </View>
  );
}
