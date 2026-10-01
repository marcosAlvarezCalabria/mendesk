import { describe, expect, it } from "vitest";

import {
  buildIntakeConfirmationMessage,
  buildReadyMessage,
  buildReviewRequestMessage,
} from "@/domain/messaging/whatsappMessages";

describe("whatsappMessages", () => {
  it("builds an English ready message", () => {
    const message = buildReadyMessage({ clientName: "Mary", locale: "en" });

    expect(message).toContain("Mary");
    expect(message).toContain("Koko Atelier");
    expect(message).toContain("ready");
  });

  it("builds a Ukrainian ready message", () => {
    const message = buildReadyMessage({ clientName: "Mary", locale: "uk" });

    expect(message).toContain("Mary");
    expect(message).toContain("готове");
  });

  it("includes the review URL in English and Ukrainian review request messages", () => {
    const reviewUrl = "https://g.page/r/koko/review";

    expect(buildReviewRequestMessage({ clientName: "Mary", reviewUrl, locale: "en" })).toContain(reviewUrl);
    expect(buildReviewRequestMessage({ clientName: "Mary", reviewUrl, locale: "uk" })).toContain(reviewUrl);
  });

  it("trims names in English intake confirmation messages", () => {
    const message = buildIntakeConfirmationMessage({ clientName: "  Mary  ", locale: "en" });

    expect(message).toContain("Mary");
    expect(message).not.toContain("  Mary  ");
    expect(message).toContain("Koko Atelier");
  });

  it("trims names in Ukrainian intake confirmation messages", () => {
    const message = buildIntakeConfirmationMessage({ clientName: "  Mary  ", locale: "uk" });

    expect(message).toContain("Mary");
    expect(message).not.toContain("  Mary  ");
    expect(message).toContain("Koko Atelier");
  });
});