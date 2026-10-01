import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OfflineRetryLink } from "@/app/offline/OfflineRetryLink";

describe("OfflineRetryLink", () => {
  it("retries the current navigation instead of losing its context", () => {
    const html = renderToStaticMarkup(<OfflineRetryLink label="Try again" />);

    expect(html).toContain('href=""');
    expect(html).not.toContain('href="/orders"');
  });
});
