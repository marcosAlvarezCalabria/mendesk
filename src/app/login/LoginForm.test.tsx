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
  it("shows the configured shop logo on a dark contrast surface", () => {
    const identity = { name: "Demo Atelier", shortName: "Demo", logo: { src: "/store/demo-atelier-mark.svg", alt: "Demo Atelier" } };
    const html = renderToStaticMarkup(<LoginForm identity={identity} nextPath="/orders" texts={texts} />);

    expect(html).toContain("demo-atelier-mark.svg");
    expect(html).toContain('alt="Demo Atelier"');
    expect(html).toContain("rounded-2xl bg-primary");
    expect(html).not.toContain("font-wordmark text-wordmark");
  });
});
