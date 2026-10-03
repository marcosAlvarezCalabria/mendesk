import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useActionState: () => [{ error: null, saved: false }, vi.fn(), false],
  useState: () => [false, vi.fn()],
}));

import { ShopProfileForm, type ShopProfileFormCopy } from "@/app/_ui/ShopProfileForm";

const copy: ShopProfileFormCopy = {
  name: "Workshop name",
  email: "Contact email",
  phone: "Contact phone",
  whatsapp: "WhatsApp number",
  address: "Workshop address",
  hint: "Private installation details.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
};

describe("ShopProfileForm", () => {
  it("preserves hidden route context while rendering the shared profile fields", () => {
    const html = renderToStaticMarkup(<ShopProfileForm
      action={vi.fn()}
      copy={copy}
      hiddenFields={{ next: "/settings" }}
      initial={{ name: "Atelier Aurora", contactEmail: "hello@example.com", contactPhone: "+353 85 123 4567" }}
    />);

    expect(html).toContain('name="next"');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('value="/settings"');
    expect(html).toContain('value="Atelier Aurora"');
  });
});
