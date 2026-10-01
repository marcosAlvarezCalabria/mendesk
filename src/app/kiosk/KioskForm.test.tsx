import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
}));
vi.mock("@/app/kiosk/useOnlineStatus", () => ({ useOnlineStatus: () => false }));

import { KioskForm } from "@/app/kiosk/KioskForm";

describe("KioskForm offline", () => {
  it("keeps the clean intake form visible but blocks sending without a connection", () => {
    const html = renderToStaticMarkup(
      <KioskForm texts={{
        successTitle: "Thank you!", successSubtitle: "You're registered.", registerAnother: "Register another",
        title: "Client details", subtitle: "Enter your details.", name: "Name", phone: "Phone",
        gdpr: "Privacy consent", submit: "Continue", submitting: "Saving",
        offline: "A connection is required. Your details have not been sent.",
        errors: { consent: "Consent", phone: "Invalid phone", name: "Enter name", unavailable: "Unavailable", unknown: "Unknown", saveFailed: "Save failed" },
      }} />,
    );

    expect(html).toContain("A connection is required. Your details have not been sent.");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain('name="name"');
    expect(html).toContain('name="phone"');
    expect(html).not.toContain("Orders");
    expect(html).not.toContain("Clients");
    expect(html).toContain('name="gdpr"');
    expect(html).toContain('required=""');
  });
});
