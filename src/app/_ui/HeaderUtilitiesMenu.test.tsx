import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: () => {},
  useRef: () => ({ current: null }),
}));

import { HeaderUtilitiesMenu } from "@/app/_ui/HeaderUtilitiesMenu";

describe("HeaderUtilitiesMenu", () => {
  it("offers Settings as the current utility destination on compact screens", () => {
    const html = renderToStaticMarkup(<HeaderUtilitiesMenu labels={{ more: "More", settings: "Settings", logout: "Log out" }} logoutAction={vi.fn()} />);

    expect(html).toContain('href="/settings"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Settings");
    expect(html).toContain("Log out");
  });
});
