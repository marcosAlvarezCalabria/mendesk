import { describe, expect, it } from "vitest";

import {
  buildIntakeConfirmationMessage,
  buildReadyMessage,
  buildReviewRequestMessage,
} from "@/domain/messaging/whatsappMessages";

describe("whatsappMessages", () => {
  it("builds an English ready message", () => {
    const message = buildReadyMessage({ clientName: "Mary", locale: "en", storeName: "Demo Atelier" });

    expect(message).toContain("Mary");
    expect(message).toContain("Demo Atelier");
    expect(message).toContain("ready");
    expect(message).not.toMatch(/Koko Atelier|Mendesk|Incandi|Incamdi/);
  });

  it("builds a Ukrainian ready message", () => {
    const message = buildReadyMessage({ clientName: "Mary", locale: "uk", storeName: "Demo Atelier" });

    expect(message).toContain("Mary");
    expect(message).toContain("готове");
  });

  it("includes the review URL in English and Ukrainian review request messages", () => {
    const reviewUrl = "https://demo.example/review";

    expect(buildReviewRequestMessage({ clientName: "Mary", reviewUrl, locale: "en", storeName: "Demo Atelier" })).toContain(reviewUrl);
    expect(buildReviewRequestMessage({ clientName: "Mary", reviewUrl, locale: "uk", storeName: "Demo Atelier" })).toContain(reviewUrl);
  });

  it("trims names in English intake confirmation messages", () => {
    const message = buildIntakeConfirmationMessage({ clientName: "  Mary  ", locale: "en", storeName: "Demo Atelier" });

    expect(message).toContain("Mary");
    expect(message).not.toContain("  Mary  ");
    expect(message).toContain("Demo Atelier");
  });

  it("trims names in Ukrainian intake confirmation messages", () => {
    const message = buildIntakeConfirmationMessage({ clientName: "  Mary  ", locale: "uk", storeName: "Demo Atelier" });

    expect(message).toContain("Mary");
    expect(message).not.toContain("  Mary  ");
    expect(message).toContain("Demo Atelier");
  });
});
