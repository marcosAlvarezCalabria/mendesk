import { describe, expect, it } from "vitest";

import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
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

  it("keeps every dictionary aligned with the English source keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(uk).sort());
  });

  it("keeps interpolation placeholders aligned in every language", () => {
    const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), `Spanish placeholders for ${key}`).toEqual(placeholders(en[key]));
      expect(placeholders(uk[key]), `Ukrainian placeholders for ${key}`).toEqual(placeholders(en[key]));
    }
  });

  it("returns Spanish copy with interpolated variables", () => {
    expect(t(es, "dashboard.title", { storeName: "Taller Demo" })).toBe("Panel de Taller Demo");
  });
});
