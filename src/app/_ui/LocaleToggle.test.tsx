import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => { throw new Error("Locale changes must not rely on a second client refresh."); } }));
vi.mock("@/i18n/setLocale", () => ({ setLocale: vi.fn() }));

import { LocaleToggle } from "@/app/_ui/LocaleToggle";

describe("LocaleToggle", () => {
  it("uses the localized accessible group name", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="uk" label="Мова" />);
    expect(html).toContain('aria-label="Мова"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("submits each locale as a server action without client-side navigation", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="en" label="Language" />);

    expect(html.match(/<form/g)).toHaveLength(2);
    expect(html).not.toContain("onClick");
  });

  it("stacks its 44px controls inside the compact tablet rail", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="en" label="Language" />);

    expect(html).toContain("md:flex-col");
    expect(html).toContain("lg:flex-row");
    expect(html).not.toContain("md:min-w-11");
    expect(html).toContain("min-h-11 min-w-11 rounded-full");
    expect(html).not.toContain("lg:min-w-0");
  });
});
