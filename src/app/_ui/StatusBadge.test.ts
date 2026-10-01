import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { getStatusBadgeView } from "@/app/_ui/StatusBadge";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("getStatusBadgeView", () => {
  const labels = {
    received: "Прийнято",
    ready: "Готово",
    collected: "Забрано",
    cancelled: "Скасовано",
    overdue: "Прострочено",
  };

  it.each([
    [OrderStatus.RECEIVED, "Прийнято", "status-received"],
    [OrderStatus.READY, "Готово", "status-ready"],
    [OrderStatus.COLLECTED, "Забрано", "status-collected"],
    [OrderStatus.CANCELLED, "Скасовано", "status-cancelled"],
  ])("maps %s to label and token classes", (status, label, token) => {
    const view = getStatusBadgeView(status, labels);

    expect(view.label).toBe(label);
    expect(view.className).toContain(token);
  });

  it("keeps overdue as a separate tag token", () => {
    expect("border-status-overdue/30 bg-status-overdue/15 text-status-overdue").toContain("status-overdue");
  });

  it.each(["ready", "overdue"])("keeps the %s badge at WCAG AA text contrast", (token) => {
    const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
    const foreground = css.match(new RegExp(`--color-status-${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

    expect(foreground).toBeDefined();
    const background = composite(foreground!, "#fbf9f5", 0.15);
    expect(contrastRatio(foreground!, background)).toBeGreaterThanOrEqual(4.5);
  });
});

function composite(foreground: string, background: string, alpha: number): string {
  const foregroundRgb = rgb(foreground);
  const backgroundRgb = rgb(background);
  const channels = foregroundRgb.map((channel, index) => Math.round(channel * alpha + backgroundRgb[index]! * (1 - alpha)));

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function contrastRatio(left: string, right: string): number {
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

function luminance(color: string): number {
  return rgb(color)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function rgb(color: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}
