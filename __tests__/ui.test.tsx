import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ConceptCard } from "../src/ui/ConceptCard";
import { RevealCard } from "../src/ui/RevealCard";
import { CaughtUpCard } from "../src/ui/CaughtUpCard";
import type { Card } from "../src/types";

const card: Card = {
  id: "cs-0001", type: "concept", domain: "cs", topic: "amortized analysis",
  title: "Why append is O(1)", body: "Doubling makes copies rare.",
  prompt: "Why is append O(1) amortized?", answer: "Geometric series bounded by 2n.",
  difficulty: 2, sources: ["https://example.com"], tags: ["complexity"],
};

describe("ConceptCard", () => {
  it("shows title and body with no grading affordance", () => {
    const { getByText, queryByText } = render(<ConceptCard card={card} height={800} />);
    getByText(card.title);
    getByText(card.body);
    expect(queryByText("Got it")).toBeNull();
    expect(queryByText("Missed it")).toBeNull();
  });
});

describe("RevealCard", () => {
  it("hides the answer until revealed, then grades", () => {
    const onGrade = jest.fn();
    const { getByText, queryByText } = render(
      <RevealCard card={card} height={800} showBody={false} onGrade={onGrade} />,
    );
    getByText(card.prompt);
    expect(queryByText(card.answer)).toBeNull();
    expect(queryByText("Got it")).toBeNull();

    fireEvent.press(getByText("Reveal"));
    getByText(card.answer);
    fireEvent.press(getByText("Got it"));
    expect(onGrade).toHaveBeenCalledWith("got");
  });

  it("shows the setup body for puzzle first exposure", () => {
    const { getByText } = render(
      <RevealCard card={card} height={800} showBody onGrade={jest.fn()} />,
    );
    getByText(card.body);
  });

  it("reports a miss", () => {
    const onGrade = jest.fn();
    const { getByText } = render(
      <RevealCard card={card} height={800} showBody={false} onGrade={onGrade} />,
    );
    fireEvent.press(getByText("Reveal"));
    fireEvent.press(getByText("Missed it"));
    expect(onGrade).toHaveBeenCalledWith("missed");
  });

  it("calls onGrade exactly once when 'Got it' is pressed twice", () => {
    const onGrade = jest.fn();
    const { getByText } = render(
      <RevealCard card={card} height={800} showBody={false} onGrade={onGrade} />,
    );
    fireEvent.press(getByText("Reveal"));
    fireEvent.press(getByText("Got it"));
    fireEvent.press(getByText("Got it"));
    expect(onGrade).toHaveBeenCalledTimes(1);
    expect(onGrade).toHaveBeenCalledWith("got");
  });

  it("calls onGrade exactly once, with 'got', when 'Missed it' is pressed after 'Got it'", () => {
    const onGrade = jest.fn();
    const { getByText, queryByText } = render(
      <RevealCard card={card} height={800} showBody={false} onGrade={onGrade} />,
    );
    fireEvent.press(getByText("Reveal"));
    fireEvent.press(getByText("Got it"));
    // Once graded, the opposing choice is no longer an available target to press.
    const missed = queryByText("Missed it");
    if (missed) fireEvent.press(missed);
    expect(onGrade).toHaveBeenCalledTimes(1);
    expect(onGrade).toHaveBeenCalledWith("got");
  });

  it("shows which choice was made after grading", () => {
    const { getByText, queryByText } = render(
      <RevealCard card={card} height={800} showBody={false} onGrade={jest.fn()} />,
    );
    fireEvent.press(getByText("Reveal"));
    fireEvent.press(getByText("Got it"));
    getByText("Got it"); // graded state still visibly confirms the choice
    expect(queryByText("Missed it")).toBeNull();
  });
});

describe("CaughtUpCard", () => {
  it("renders the terminal message", () => {
    const { getByText } = render(<CaughtUpCard height={800} />);
    getByText(/caught up/i);
  });
});
