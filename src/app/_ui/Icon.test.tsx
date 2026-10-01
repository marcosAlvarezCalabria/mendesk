import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Icon } from "@/app/_ui/Icon";

describe("Icon", () => {
  it("renders a code-native SVG without relying on an icon font", () => {
    const markup = renderToStaticMarkup(<Icon className="text-outline" name="search" />);

    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("text-outline");
    expect(markup).not.toContain(">search<");
  });

  it("uses a stable fallback for unknown legacy icon names", () => {
    const markup = renderToStaticMarkup(<Icon name="unknown" />);

    expect(markup).toContain("<circle");
  });

  it.each(["cloud_off", "refresh"])("renders the %s recovery icon instead of the fallback", (name) => {
    const markup = renderToStaticMarkup(<Icon name={name} />);
    const fallback = renderToStaticMarkup(<Icon name="unknown" />);

    expect(markup).toContain("<path");
    expect(markup).not.toBe(fallback);
  });
});
