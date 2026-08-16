import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { CardState, ReviewLogEntry } from "../src/types";

// An in-memory stand-in for the SQLite store, so screens can be mounted and driven in
// jest. Named with the `mock` prefix so jest.mock's factory may close over it.
const mockData = {
  states: new Map<string, CardState>(),
  settings: new Map<string, string>(),
  log: [] as ReviewLogEntry[],
  bookmarks: [] as string[],
};

const mockStore = {
  getState: (id: string) => mockData.states.get(id) ?? null,
  putState: (s: CardState) => void mockData.states.set(s.cardId, s),
  getDue: (now: number, limit: number) =>
    [...mockData.states.values()].filter((s) => s.dueAt <= now).slice(0, limit),
  getSeenIds: () => new Set(mockData.states.keys()),
  getAllStates: () => [...mockData.states.values()],
  getSetting: (k: string) => mockData.settings.get(k) ?? null,
  putSetting: (k: string, v: string) => void mockData.settings.set(k, v),
  logReview: (e: ReviewLogEntry) => void mockData.log.push(e),
  getReviewLog: (since: number) => mockData.log.filter((e) => e.at >= since),
  getBookmarks: () => [...mockData.bookmarks],
  toggleBookmark: (id: string) => {
    const at = mockData.bookmarks.indexOf(id);
    if (at >= 0) {
      mockData.bookmarks.splice(at, 1);
      return false;
    }
    mockData.bookmarks.unshift(id);
    return true;
  },
  reset: () => {
    mockData.states.clear();
    mockData.log.length = 0;
  },
};

jest.mock("../src/store", () => ({ openStore: () => mockStore }));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams = { id: "cs-0001" };

jest.mock("expo-router", () => {
  const ReactLocal = require("react");
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    // The real hook runs its effect on focus; a mounted screen in a test is focused.
    useFocusEffect: (cb: () => void) => ReactLocal.useEffect(cb, [cb]),
    Redirect: ({ href }: { href: string }) => ReactLocal.createElement("Redirect", { href }),
  };
});

import FeedScreen from "../app/index";
import LibraryScreen from "../app/library";
import QuizScreen from "../app/quiz";
import ProgressScreen from "../app/stats";
import SettingsScreen from "../app/settings";
import OnboardingScreen from "../app/onboarding";
import CardDetailScreen from "../app/card/[id]";
import { getCard, loadCorpus, countByDomain } from "../src/corpus";

// Corpus counts are derived, never hardcoded: cards are added over time and only
// their ids are stable, so a literal here turns every content addition into a
// spurious test failure.
const TOTAL = loadCorpus().length;
const BY_DOMAIN = countByDomain();
const BY_LEVEL = loadCorpus().reduce<Record<number, number>>(
  (acc, c) => ({ ...acc, [c.difficulty]: (acc[c.difficulty] ?? 0) + 1 }),
  {},
);

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mount = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

beforeEach(() => {
  mockData.states.clear();
  mockData.settings.clear();
  mockData.log.length = 0;
  mockData.bookmarks.length = 0;
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  // Every test but the onboarding one starts past the first-run gate.
  mockData.settings.set("onboardingDone", "1");
});

describe("Feed screen", () => {
  it("redirects a first-run user to onboarding", () => {
    mockData.settings.delete("onboardingDone");
    const { UNSAFE_getByType } = mount(<FeedScreen />);
    expect(UNSAFE_getByType("Redirect" as never).props.href).toBe("/onboarding");
  });

  it("renders cards with a tab bar and a subject filter", () => {
    const { getByText, getByLabelText } = mount(<FeedScreen />);
    getByText("All domains");
    getByLabelText("Feed");
    getByLabelText("Library");
  });

  it("navigates to another tab", () => {
    const { getByLabelText } = mount(<FeedScreen />);
    fireEvent.press(getByLabelText("Progress"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/stats");
  });

  it("shows a due badge once cards are due", () => {
    mockData.states.set("cs-0001", {
      cardId: "cs-0001",
      status: "review",
      ease: 2.5,
      intervalDays: 3,
      dueAt: Date.now() - 1000,
      lapses: 0,
      reps: 3,
      lastSeenAt: Date.now(),
    });
    const { getByText } = mount(<FeedScreen />);
    getByText("1 due");
  });

  it("serves only the persisted levels", () => {
    mockData.settings.set("selectedLevels", "[3]");
    const { queryByText } = mount(<FeedScreen />);
    const shown = loadCorpus().filter((c) => queryByText(c.title) !== null);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((c) => c.difficulty === 3)).toBe(true);
  });
});

describe("Library screen", () => {
  it("lists the whole corpus and reports the count", () => {
    const { getByText, getAllByText } = mount(<LibraryScreen />);
    // Two matches: the screen title and this tab's label in the bar below.
    expect(getAllByText("Library")).toHaveLength(2);
    getByText(`${TOTAL} of ${TOTAL} concepts`);
  });

  it("narrows the list as the user types", () => {
    const { getByLabelText, getByText } = mount(<LibraryScreen />);
    fireEvent.changeText(getByLabelText("Search all concepts"), "hash");
    expect(getByText(/of \d+ concepts/).props.children).not.toContain(`${TOTAL} of`);
  });

  it("shows an empty state for a query that matches nothing", () => {
    const { getByLabelText, getByText } = mount(<LibraryScreen />);
    fireEvent.changeText(getByLabelText("Search all concepts"), "zzzzqqq");
    getByText("No matches");
    getByText(`0 of ${TOTAL} concepts`);
  });

  it("filters by subject chip", () => {
    const { getByText } = mount(<LibraryScreen />);
    fireEvent.press(getByText("Finance"));
    getByText(`${BY_DOMAIN.finance} of ${TOTAL} concepts`);
  });

  it("opens a concept", () => {
    const { getAllByText } = mount(<LibraryScreen />);
    // Every row's status pill is "New" on a fresh install; pressing one opens its card.
    fireEvent.press(getAllByText("New")[0]);
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining("/card/"));
  });

  it("filters by level chip", () => {
    const { getByText } = mount(<LibraryScreen />);
    fireEvent.press(getByText("Graduate+"));
    getByText(`${BY_LEVEL[3]} of ${TOTAL} concepts`);
  });

  it("intersects a level chip with a subject chip", () => {
    const { getByText } = mount(<LibraryScreen />);
    fireEvent.press(getByText("Finance"));
    fireEvent.press(getByText("Graduate+"));
    const expected = loadCorpus().filter(
      (c) => c.domain === "finance" && c.difficulty === 3,
    ).length;
    getByText(`${expected} of ${TOTAL} concepts`);
  });
});

describe("Quiz screen", () => {
  it("offers a run and reports what is available", () => {
    const { getByText, getAllByText } = mount(<QuizScreen />);
    expect(getAllByText("Quiz")).toHaveLength(2); // screen title and tab label
    getByText(`${TOTAL} concepts available across all subjects.`);
    getByText("Start 10-question quiz");
  });

  it("runs a question, grades it, and logs the answer", () => {
    const { getByText } = mount(<QuizScreen />);
    fireEvent.press(getByText("Start 10-question quiz"));
    getByText("Question 1 of 10");

    fireEvent.press(getByText("Reveal answer"));
    fireEvent.press(getByText("Got it"));

    getByText("Question 2 of 10");
    expect(mockData.log).toHaveLength(1);
    expect(mockData.log[0].grade).toBe("got");
    expect(mockData.states.size).toBe(1);
  });

  it("reaches a scored summary at the end of a run", () => {
    const { getByText } = mount(<QuizScreen />);
    fireEvent.press(getByText("5"));
    fireEvent.press(getByText("Start 5-question quiz"));

    for (let i = 0; i < 5; i++) {
      fireEvent.press(getByText("Reveal answer"));
      fireEvent.press(getByText(i === 0 ? "Missed it" : "Got it"));
    }

    getByText("80%");
    getByText("4 of 5 correct");
    getByText("Retry 1 missed");
  });

  it("shortens a run to the smaller of the size and the subject pool", () => {
    const { getByText } = mount(<QuizScreen />);
    fireEvent.press(getByText("Math"));
    getByText(`${BY_DOMAIN.math} concepts available in your selection.`);
  });
});

describe("Progress screen", () => {
  it("renders the goal, the tiles and the empty activity chart", () => {
    const { getByText, getAllByText } = mount(<ProgressScreen />);
    expect(getAllByText("Progress")).toHaveLength(2); // screen title and tab label
    getByText("0 / 10 reviews");
    getByText("Last 28 days");
    getByText(/No reviews logged yet/);
  });

  it("reflects logged reviews in the goal, streak and accuracy", () => {
    const now = Date.now();
    mockData.log.push(
      { cardId: "cs-0001", grade: "got", at: now },
      { cardId: "cs-0002", grade: "got", at: now },
      { cardId: "cs-0003", grade: "missed", at: now },
    );
    const { getByText, queryByText } = mount(<ProgressScreen />);
    getByText("3 / 10 reviews");
    getByText("7 to go.");
    getByText("67%"); // 2 of 3 correct
    expect(queryByText(/No reviews logged yet/)).toBeNull();
  });

  it("honours a custom daily goal", () => {
    mockData.settings.set("dailyGoal", "20");
    const { getByText } = mount(<ProgressScreen />);
    getByText("0 / 20 reviews");
  });
});

describe("Settings screen", () => {
  it("persists a new daily goal", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("40"));
    expect(mockData.settings.get("dailyGoal")).toBe("40");
  });

  it("reports the library size and saved count", () => {
    mockData.bookmarks.push("cs-0001");
    const { getByText } = mount(<SettingsScreen />);
    getByText("Concepts available");
    getByText(String(TOTAL));
    getByText("Saved cards");
    getByText("1");
  });

  it("sends the user back through the intro", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("Replay the intro"));
    expect(mockData.settings.get("onboardingDone")).toBe("0");
    expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding");
  });

  it("persists a level selection", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("Graduate+"));
    expect(mockData.settings.get("selectedLevels")).toBe("[3]");
  });

  it("normalizes a full selection back to every level", () => {
    const { getByText } = mount(<SettingsScreen />);
    fireEvent.press(getByText("High school"));
    fireEvent.press(getByText("Undergrad"));
    fireEvent.press(getByText("Graduate+"));
    expect(mockData.settings.get("selectedLevels")).toBe("[]");
  });
});

describe("Onboarding screen", () => {
  it("walks three panels and marks itself complete", () => {
    const { getByText } = mount(<OnboardingScreen />);
    getByText("Scroll to learn one idea at a time");

    fireEvent.press(getByText("Next"));
    getByText("Remembered right before you'd forget");

    fireEvent.press(getByText("Next"));
    getByText("Search, quiz, and track what sticks");

    fireEvent.press(getByText("Start learning"));
    expect(mockData.settings.get("onboardingDone")).toBe("1");
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("can be skipped from the first panel", () => {
    const { getByText } = mount(<OnboardingScreen />);
    fireEvent.press(getByText("Skip"));
    expect(mockData.settings.get("onboardingDone")).toBe("1");
  });
});

describe("Card detail screen", () => {
  it("shows the concept, its schedule and related concepts", () => {
    const { getByText } = mount(<CardDetailScreen />);
    // Read the expected title from the corpus rather than hardcoding the prose:
    // card text is revised freely (only ids are stable), so a literal here fails
    // the suite for an edit that broke nothing.
    getByText(getCard("cs-0001")!.title);
    getByText("Test yourself");
    getByText("Your schedule");
    getByText("Not started");
    getByText("New");
  });

  it("reveals the answer and grades it into the store and the log", () => {
    const { getByText } = mount(<CardDetailScreen />);
    fireEvent.press(getByText("Reveal answer"));
    fireEvent.press(getByText("Got it"));

    expect(mockData.states.has("cs-0001")).toBe(true);
    expect(mockData.log).toEqual([
      expect.objectContaining({ cardId: "cs-0001", grade: "got" }),
    ]);
  });

  it("toggles the bookmark", () => {
    const { getByLabelText } = mount(<CardDetailScreen />);
    fireEvent.press(getByLabelText("Save this card"));
    expect(mockData.bookmarks).toEqual(["cs-0001"]);
    fireEvent.press(getByLabelText("Remove from saved"));
    expect(mockData.bookmarks).toEqual([]);
  });

  it("degrades to a not-found state for an unknown id", () => {
    const original = mockParams.id;
    mockParams.id = "does-not-exist";
    try {
      const { getByText } = mount(<CardDetailScreen />);
      getByText("Concept not found");
    } finally {
      mockParams.id = original;
    }
  });
});
