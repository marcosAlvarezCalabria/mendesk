import { describe, expect, it } from "vitest";

import { en } from "@/i18n/dictionaries/en";
import { uk } from "@/i18n/dictionaries/uk";
import { t } from "@/i18n/t";

describe("t", () => {
  it("returns an existing translation without variables", () => {
    expect(t(en, "nav.orders")).toBe("Orders");
  });

  it("interpolates supplied variables", () => {
    const dictionary = { ...en, "nav.orders": "Hello, {name}" };

    expect(t(dictionary, "nav.orders", { name: "Mary" })).toBe("Hello, Mary");
  });

  it("falls back to English when a translation is missing", () => {
    const dictionary = { ...uk, "nav.orders": "" };

    expect(t(dictionary, "nav.orders")).toBe("Orders");
  });

  it("keeps English and Ukrainian dictionary keys aligned", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(uk).sort());
  });
});
