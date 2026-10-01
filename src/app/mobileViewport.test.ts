import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile viewport containment", () => {
  const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

  it("provides a horizontal overflow fallback before clip for older mobile Safari", () => {
    expect(css).toMatch(/html\s*{[^}]*overflow-x:\s*hidden;[^}]*overflow-x:\s*clip;/);
    expect(css).toMatch(/body\s*{[^}]*overflow-x:\s*hidden;[^}]*overflow-x:\s*clip;/);
  });

  it("allows form containers and controls to shrink inside the viewport", () => {
    expect(css).toMatch(/form,[\s\S]*fieldset\s*{[^}]*min-inline-size:\s*0;[^}]*max-inline-size:\s*100%;/);
    expect(css).toMatch(/input,[\s\S]*textarea\s*{[^}]*box-sizing:\s*border-box;/);
  });
});
