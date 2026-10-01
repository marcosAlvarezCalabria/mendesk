import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: () => [{ error: null }, vi.fn(), false],
}));
vi.mock("@/app/login/actions", () => ({ loginAction: vi.fn() }));

import { LoginForm } from "@/app/login/LoginForm";

const texts = {
  title: "Welcome back",
  subtitle: "Sign in to continue",
  email: "Email",
  password: "Password",
  submit: "Sign in",
  submitting: "Signing in...",
  error: "Sign in failed",
};

describe("LoginForm", () => {
  it("shows the Koko Atelier logo on a dark contrast surface", () => {
    const html = renderToStaticMarkup(<LoginForm nextPath="/orders" texts={texts} />);

    expect(html).toContain("koko-atelier-logo.png");
    expect(html).toContain('alt="Koko Atelier"');
    expect(html).toContain("rounded-2xl bg-primary");
    expect(html).not.toContain("font-wordmark text-wordmark");
  });
});
