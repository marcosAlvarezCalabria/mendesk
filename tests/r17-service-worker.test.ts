import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = {
  request?: { method: string; mode: string };
  respondWith?: (response: Promise<unknown>) => void;
  waitUntil?: (work: Promise<unknown>) => void;
};

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("R17 service worker privacy contract", () => {
  it("does not intercept a navigation mutation", () => {
    const runtime = makeRuntime();
    const respondWith = vi.fn();

    runtime.listeners.fetch({ request: { method: "POST", mode: "navigate" }, respondWith });

    expect(respondWith).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the public offline shell without caching the private response", async () => {
    const runtime = makeRuntime();
    const respondWith = vi.fn();
    runtime.fetch.mockRejectedValueOnce(new Error("offline"));

    runtime.listeners.fetch({ request: { method: "GET", mode: "navigate" }, respondWith });

    expect(await respondWith.mock.calls[0][0]).toBe("offline-shell");
    expect(runtime.caches.open).not.toHaveBeenCalled();
  });

  it("removes obsolete Mendesk caches and the explicitly supported Koko legacy cache", async () => {
    const runtime = makeRuntime();
    const waitUntil = vi.fn();
    runtime.caches.keys.mockResolvedValueOnce([
      "mendesk-pwa-shell-v0",
      "mendesk-pwa-shell-v2",
      "koko-pwa-shell-v1",
      "other-app",
    ]);

    runtime.listeners.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(runtime.caches.delete).toHaveBeenCalledTimes(2);
    expect(runtime.caches.delete).toHaveBeenCalledWith("mendesk-pwa-shell-v0");
    expect(runtime.caches.delete).toHaveBeenCalledWith("koko-pwa-shell-v1");
    expect(runtime.caches.delete).not.toHaveBeenCalledWith("mendesk-pwa-shell-v2");
    expect(runtime.caches.delete).not.toHaveBeenCalledWith("other-app");
  });
});

function makeRuntime() {
  const listeners: Record<string, (event: WorkerEvent) => void> = {};
  const caches = {
    open: vi.fn(async () => ({ addAll: vi.fn() })),
    keys: vi.fn(async () => [] as string[]),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => "offline-shell"),
  };
  const fetch = vi.fn(async () => "network-response");
  const self = {
    addEventListener: (name: string, listener: (event: WorkerEvent) => void) => { listeners[name] = listener; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };

  runInNewContext(source, { caches, fetch, self });
  return { caches, fetch, listeners, self };
}
