import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile navigation safe area", () => {
  it("uses the static maximum inset so Safari chrome changes do not resize the menu", () => {
    const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

    expect(css).toContain("--mobile-navigation-safe-area: env(safe-area-max-inset-bottom, env(safe-area-inset-bottom));");
  });
});
