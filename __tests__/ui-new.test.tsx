import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { CardRow } from "../src/ui/CardRow";
import { CardActions } from "../src/ui/CardActions";
import { Chip } from "../src/ui/Chip";
import { ConceptCard } from "../src/ui/ConceptCard";
import { SaveButton } from "../src/ui/SaveButton";
import { StatusPill, pillFor } from "../src/ui/StatusPill";
import { TabBar } from "../src/ui/TabBar";
import { TopBar } from "../src/ui/TopBar";
import type { Card } from "../src/types";

const card: Card = {
  id: "cs-0001",
  type: "concept",
  domain: "cs",
  topic: "amortized analysis",
  title: "Why append is O(1)",
  body: "Doubling makes copies rare.",
  prompt: "Why is append O(1) amortized?",
  answer: "Geometric series bounded by 2n.",
  difficulty: 2,
  sources: ["https://example.com"],
  tags: ["complexity"],
};

describe("pillFor", () => {
  it("prefers 'due' over the learning status once a card is due", () => {
    expect(pillFor("learning", true)).toBe("due");
    expect(pillFor("mastered", true)).toBe("due");
  });

  it("keeps the learning status when the card is not due", () => {
    expect(pillFor("learning", false)).toBe("learning");
    expect(pillFor("mastered", false)).toBe("mastered");
  });

  it("never marks an unseen card as due", () => {
    expect(pillFor("new", true)).toBe("new");
  });
});

describe("StatusPill", () => {
  it("labels each kind", () => {
    expect(render(<StatusPill kind="new" />).getByText("New")).toBeTruthy();
    expect(render(<StatusPill kind="learning" />).getByText("Learning")).toBeTruthy();
    expect(render(<StatusPill kind="mastered" />).getByText("Mastered")).toBeTruthy();
    expect(render(<StatusPill kind="due" />).getByText("Due now")).toBeTruthy();
  });
});

describe("Chip", () => {
  it("reports its selected state for assistive tech and fires on press", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Chip label="Math" selected onPress={onPress} />);
    const chip = getByRole("button", { name: "Math" });
    expect(chip.props.accessibilityState.selected).toBe(true);
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });
});

describe("SaveButton", () => {
  it("shows a filled star and an unsave label when saved", () => {
    const { getByText, getByLabelText } = render(<SaveButton saved onPress={jest.fn()} />);
    getByText("★");
    getByLabelText("Remove from saved");
  });

  it("shows an outline star and a save label when not saved", () => {
    const { getByText, getByLabelText } = render(<SaveButton saved={false} onPress={jest.fn()} />);
    getByText("☆");
    getByLabelText("Save this card");
  });

  it("fires on press", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<SaveButton saved={false} onPress={onPress} />);
    fireEvent.press(getByLabelText("Save this card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("CardRow", () => {
  it("shows subject, topic, title and status, and opens on press", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CardRow card={card} pill="due" saved={false} onPress={onPress} />,
    );
    getByText("CS · amortized analysis");
    getByText(card.title);
    getByText("Due now");
    fireEvent.press(getByText(card.title));
    expect(onPress).toHaveBeenCalled();
  });

  it("marks a saved card with a star", () => {
    const { queryByText, rerender } = render(
      <CardRow card={card} pill="new" saved={false} onPress={jest.fn()} />,
    );
    expect(queryByText("★")).toBeNull();
    rerender(<CardRow card={card} pill="new" saved onPress={jest.fn()} />);
    expect(queryByText("★")).not.toBeNull();
  });
});

describe("CardActions", () => {
  it("wires save and open independently", () => {
    const onToggleSave = jest.fn();
    const onOpen = jest.fn();
    const { getByText, getByLabelText } = render(
      <CardActions saved={false} onToggleSave={onToggleSave} onOpen={onOpen} />,
    );
    fireEvent.press(getByLabelText("Save this card"));
    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.press(getByText("Open concept ›"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("ConceptCard actions", () => {
  it("renders no action row when the feed supplies no handlers", () => {
    const { queryByText } = render(<ConceptCard card={card} height={800} />);
    expect(queryByText("Open concept ›")).toBeNull();
  });

  it("renders the action row when handlers are supplied", () => {
    const { getByText } = render(
      <ConceptCard
        card={card}
        height={800}
        saved={false}
        onToggleSave={jest.fn()}
        onOpen={jest.fn()}
      />,
    );
    getByText("Open concept ›");
  });
});

describe("TopBar", () => {
  it("shows the subject label and opens the picker", () => {
    const onPressDomains = jest.fn();
    const { getByText } = render(
      <TopBar domainLabel="All domains" dueCount={0} onPressDomains={onPressDomains} />,
    );
    fireEvent.press(getByText("All domains"));
    expect(onPressDomains).toHaveBeenCalled();
  });

  it("shows a due badge only when something is due", () => {
    const { queryByText } = render(
      <TopBar domainLabel="Math" dueCount={0} onPressDomains={jest.fn()} />,
    );
    expect(queryByText(/due/)).toBeNull();

    const { getByText } = render(
      <TopBar domainLabel="Math" dueCount={7} onPressDomains={jest.fn()} />,
    );
    getByText("7 due");
  });
});

describe("TabBar", () => {
  it("renders every destination", () => {
    const { getByText } = render(<TabBar active="feed" onSelect={jest.fn()} />);
    for (const label of ["Feed", "Library", "Quiz", "Progress"]) getByText(label);
  });

  it("marks the active tab as selected", () => {
    const { getByLabelText } = render(<TabBar active="quiz" onSelect={jest.fn()} />);
    expect(getByLabelText("Quiz").props.accessibilityState.selected).toBe(true);
    expect(getByLabelText("Feed").props.accessibilityState.selected).toBe(false);
  });

  it("reports the tapped destination", () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(<TabBar active="feed" onSelect={onSelect} />);
    fireEvent.press(getByLabelText("Library"));
    expect(onSelect).toHaveBeenCalledWith("library");
  });
});
