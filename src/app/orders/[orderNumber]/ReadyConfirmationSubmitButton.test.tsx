import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const form = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", () => ({
  useFormStatus: () => ({ pending: form.pending }),
}));

import { ReadyConfirmationSubmitButton } from "./ReadyConfirmationSubmitButton";

describe("ReadyConfirmationSubmitButton", () => {
  beforeEach(() => { form.pending = false; });

  it("provides local pressed feedback before the network state", () => {
    const html = renderToStaticMarkup(<ReadyConfirmationSubmitButton disabled={false} label="Mark Ready" pendingLabel="Marking Ready…" />);

    expect(html).toContain("Mark Ready");
    expect(html).toContain("active:scale-[0.98]");
    expect(html).toContain("duration-75");
    expect(html).toContain("motion-reduce:transform-none");
  });

  it("distinguishes the network wait without claiming success", () => {
    form.pending = true;
    const html = renderToStaticMarkup(<ReadyConfirmationSubmitButton disabled={false} label="Mark Ready" pendingLabel="Marking Ready…" />);

    expect(html).toContain("Marking Ready…");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).not.toContain("Order marked Ready");
  });
});
