import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { createSession, nextChunk, type FeedDeps } from "../src/feed";
import { openStore } from "../src/store";
import { getCard, getUnseen } from "../src/corpus";
import { loadSelectedDomains, loadSelectedLevels } from "../src/format";
import { initialState, review } from "../src/scheduler";
import { ConceptCard } from "../src/ui/ConceptCard";
import { RevealCard } from "../src/ui/RevealCard";
import { CaughtUpCard } from "../src/ui/CaughtUpCard";
import { TopBar, TOP_BAR_HEIGHT } from "../src/ui/TopBar";
import { DomainSheet } from "../src/ui/DomainSheet";
import { TabBar, TAB_ROUTES, TAB_BAR_HEIGHT, type TabKey } from "../src/ui/TabBar";
import { syncWidgetPreferences } from "../src/widget/preferences";
import {
  CHUNK_SIZE,
  DOMAIN_LABELS_SHORT,
  FEED_ADVANCE_DELAY_MS,
  SESSION_IDLE_MS,
} from "../src/constants";
import type { Domain, FeedItem, Grade, Level, Session } from "../src/types";

const rng = () => Math.random();

const labelForDomains = (domains: Domain[]): string =>
  domains.length === 0 ? "All domains" : domains.map((d) => DOMAIN_LABELS_SHORT[d]).join(" + ");

// Comparing by sorted key rather than element-wise keeps the check order-proof.
const levelKey = (levels: Level[]): string =>
  [...levels].sort((a, b) => a - b).join(",");

export default function FeedScreen() {
  const { height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The top bar and the tab bar bracket the feed, so a full card is the window minus
  // both insets and both bars. Paging snaps to this height.
  const height = winHeight - insets.top - insets.bottom - TOP_BAR_HEIGHT - TAB_BAR_HEIGHT;

  const router = useRouter();
  const store = useMemo(() => openStore(), []);
  const corpus = useMemo(() => ({ getUnseen, getCard }), []);

  // First-run gate. Read once so the decision is stable for this mount: a fresh mount
  // after onboarding completes re-reads the (now set) flag and renders the feed.
  const [needsOnboarding] = useState(() => store.getSetting("onboardingDone") !== "1");

  const [selectedDomains, setSelectedDomains] = useState<Domain[]>(() =>
    loadSelectedDomains(store.getSetting("selectedDomains")),
  );
  const [selectedLevels, setSelectedLevels] = useState<Level[]>(() =>
    loadSelectedLevels(store.getSetting("selectedLevels")),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  // Saved cards and the due count are also changed from the Library, the card detail
  // screen and the quiz, so both are re-read whenever the feed comes back into focus.
  const [saved, setSaved] = useState<Set<string>>(() => new Set(store.getBookmarks()));
  const [dueCount, setDueCount] = useState(0);

  const refreshDueCount = useCallback(() => {
    const now = Date.now();
    setDueCount(store.getAllStates().filter((s) => s.dueAt <= now).length);
  }, [store]);

  const toggleSave = useCallback(
    (cardId: string) => {
      const nowSaved = store.toggleBookmark(cardId, Date.now());
      setSaved((prev) => {
        const next = new Set(prev);
        if (nowSaved) next.add(cardId);
        else next.delete(cardId);
        return next;
      });
    },
    [store],
  );

  const session = useRef<Session>(createSession(rng));
  const seeded = useRef<Set<string>>(new Set());
  const [items, setItems] = useState<FeedItem[]>([]);
  const [done, setDone] = useState(false);
  const listRef = useRef<FlatList<FeedItem>>(null);
  const pendingScrollReset = useRef(false);

  const deps = useCallback(
    (over?: Partial<FeedDeps>): FeedDeps => ({
      corpus, store, now: Date.now(), rng,
      domains: selectedDomains, levels: selectedLevels, ...over,
    }),
    [corpus, store, selectedDomains, selectedLevels],
  );

  const loadMore = useCallback(() => {
    if (done) return;
    const chunk = nextChunk(deps(), session.current, CHUNK_SIZE);
    if (chunk.some((i) => i.kind === "caught-up")) setDone(true);
    setItems((prev) => [...prev, ...chunk]);
  }, [deps, done]);

  // Starts a brand-new session from the given deps and snaps the scroll back to the top.
  // Used by the idle reset, by applying a new domain filter, and by the focus-effect
  // level sync. Takes deps explicitly so a caller can pass freshly-chosen domains or
  // levels without waiting for state to settle.
  const restartSession = useCallback((d: FeedDeps) => {
    session.current = createSession(rng);
    seeded.current = new Set();
    setDone(false);
    pendingScrollReset.current = true;
    setItems(nextChunk(d, session.current, CHUNK_SIZE));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSaved(new Set(store.getBookmarks()));
      refreshDueCount();
      // Defensive, not the live mechanism: the feed is only reachable from Settings via
      // a route that unmounts this screen first (Settings opens from Library or Progress,
      // never from here), so the useState initializer's mount-time read of selectedLevels
      // is what actually picks up a level chosen in Settings today. This effect only
      // matters if a future Settings entry point from the feed's own top bar keeps the
      // feed mounted underneath. Restart only on an actual change.
      const stored = loadSelectedLevels(store.getSetting("selectedLevels"));
      if (levelKey(stored) !== levelKey(selectedLevels)) {
        setSelectedLevels(stored);
        restartSession(deps({ levels: stored }));
      }
    }, [store, refreshDueCount, deps, restartSession, selectedLevels]),
  );

  // Reset the session on cold start, or on foreground after >= 30 min in background.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
      } else if (next === "active" && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= SESSION_IDLE_MS) {
          restartSession(deps());
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [deps, restartSession]);

  // Skip the first fetch for a first-run user: they are about to be redirected to
  // onboarding, so loading a feed chunk here would be wasted work.
  useEffect(() => {
    if (!needsOnboarding) loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After a session reset replaces the item list, snap the scroll position
  // back to the first card so the user isn't stranded mid-list.
  useEffect(() => {
    if (pendingScrollReset.current) {
      pendingScrollReset.current = false;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [items]);

  // A concept card is a passive read: seeing it is what schedules its first review.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedItem }> }) => {
      for (const v of viewableItems) {
        const it = v.item;
        if (it.kind !== "new-concept") continue;
        if (seeded.current.has(it.card.id)) continue;
        seeded.current.add(it.card.id);
        store.putState(initialState(it.card.id, Date.now(), rng));
      }
    },
  ).current;

  const grade = useCallback(
    (item: FeedItem, g: Grade) => {
      if (item.kind === "caught-up") return;
      const now = Date.now();
      const prev = store.getState(item.card.id) ?? initialState(item.card.id, now, rng);
      store.putState(review(prev, g, now, rng));
      // Logged as well as stored: card_state holds only the latest snapshot, so the
      // streak, activity chart and accuracy figures all read this append-only log.
      store.logReview({ cardId: item.card.id, grade: g, at: now });
      refreshDueCount();
    },
    [store, refreshDueCount],
  );

  // Once a card is graded the page is finished, so the feed carries the reader on to the
  // next one rather than making them swipe. The short delay leaves the confirmation on
  // screen; a second grade before it fires replaces the pending scroll.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const advanceFrom = useCallback(
    (index: number) => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        listRef.current?.scrollToOffset({ offset: (index + 1) * height, animated: true });
      }, FEED_ADVANCE_DELAY_MS);
    },
    [height],
  );

  // Persist the chosen subjects and immediately rebuild the feed from them. The new
  // domains are threaded straight into deps so the restart does not race the state update.
  const applyDomains = useCallback(
    (domains: Domain[]) => {
      store.putSetting("selectedDomains", JSON.stringify(domains));
      setSelectedDomains(domains);
      setSheetOpen(false);
      restartSession(deps({ domains }));
      syncWidgetPreferences(store);
    },
    [store, restartSession, deps],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
      if (item.kind === "caught-up") return <CaughtUpCard height={height} />;
      const open = () => router.push(`/card/${item.card.id}`);
      if (item.kind === "new-concept") {
        return (
          <ConceptCard
            card={item.card}
            height={height}
            saved={saved.has(item.card.id)}
            onToggleSave={() => toggleSave(item.card.id)}
            onOpen={open}
          />
        );
      }
      return (
        <RevealCard
          card={item.card}
          height={height}
          showBody={item.kind === "new-puzzle"}
          onGrade={(g) => {
            grade(item, g);
            advanceFrom(index);
          }}
          saved={saved.has(item.card.id)}
          onToggleSave={() => toggleSave(item.card.id)}
          onOpen={open}
        />
      );
    },
    [advanceFrom, height, grade, router, saved, toggleSave],
  );

  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <View
      className="flex-1 bg-neutral-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <TopBar
        domainLabel={labelForDomains(selectedDomains)}
        dueCount={dueCount}
        onPressDomains={() => setSheetOpen(true)}
      />
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item, i) => (item.kind === "caught-up" ? `caught-up-${i}` : item.card.id)}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 400 }}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
      />
      <View style={{ height: TAB_BAR_HEIGHT }}>
        <TabBar
          active="feed"
          onSelect={(t: TabKey) => {
            if (t !== "feed") router.replace(TAB_ROUTES[t]);
          }}
        />
      </View>

      <DomainSheet
        visible={sheetOpen}
        selected={selectedDomains}
        onApply={applyDomains}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
