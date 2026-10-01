import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));
vi.mock("@/app/_ui/HeaderUtilitiesMenu", () => ({ HeaderUtilitiesMenu: () => null }));
vi.mock("@/app/_ui/LocaleToggle", () => ({ LocaleToggle: () => null }));

import { AppHeader } from "@/app/_ui/AppHeader";

describe("AppHeader", () => {
  it("uses the configured shop as the primary header identity", async () => {
    const html = renderToStaticMarkup(await AppHeader({ title: "Orders" }));

    expect(html).toContain("Demo Atelier");
    expect(html).not.toContain("Koko Atelier");
  });

  it("presents Back as a visible bordered icon control", async () => {
    const html = renderToStaticMarkup(await AppHeader({
      backHref: "/orders",
      backLabel: "Back to orders",
      title: "260925-0053",
      variant: "back",
    }));

    expect(html).toMatch(/<a aria-label="Back to orders" class="[^"]*\bborder\b[^"]*\bborder-outline-variant\b[^"]*\bbg-surface-container-lowest\b[^"]*" href="\/orders">/);
  });
});
