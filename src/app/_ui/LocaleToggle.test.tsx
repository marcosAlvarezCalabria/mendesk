import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => { throw new Error("Locale changes must not rely on a second client refresh."); } }));
vi.mock("@/i18n/setLocale", () => ({ setLocale: vi.fn() }));

import { LocaleToggle } from "@/app/_ui/LocaleToggle";

describe("LocaleToggle", () => {
  it("uses a localized name on an icon-only disclosure", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="uk" label="Мова" />);
    expect(html).toContain("<details");
    expect(html).toContain('<summary aria-label="Мова"');
    expect(html).toContain('class="icon size-[1.125rem]"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Українська");
  });

  it("submits each locale as a server action without client-side navigation", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="en" label="Language" />);

    expect(html.match(/<form/g)).toHaveLength(3);
    expect(html).toContain("Español");
    expect(html).toContain("English");
    expect(html).toContain("Українська");
  });

  it("keeps a 44px trigger and opens to the right of the compact tablet rail", () => {
    const html = renderToStaticMarkup(<LocaleToggle currentLocale="en" label="Language" />);

    expect(html).toContain("size-11 cursor-pointer");
    expect(html).toContain("md:left-[calc(100%+0.5rem)]");
    expect(html).toContain("min-h-11 w-full");
  });

  it("only renders languages enabled for the installation", () => {
    const html = renderToStaticMarkup(<LocaleToggle availableLocales={["es", "en"]} currentLocale="es" label="Idioma" />);

    expect(html).toContain("Español");
    expect(html).toContain("English");
    expect(html).not.toContain("Українська");
    expect(renderToStaticMarkup(<LocaleToggle availableLocales={["es"]} currentLocale="es" label="Idioma" />)).toBe("");
  });
});
