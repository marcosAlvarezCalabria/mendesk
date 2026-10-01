import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import Home from "./page";

describe("Home", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
  });

  it("redirects the root route to orders", () => {
    Home();

    expect(mocks.redirect).toHaveBeenCalledWith("/orders");
  });
});
