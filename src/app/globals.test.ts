import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

const statusTokens = [
  "status-received",
  "status-ready",
  "status-collected",
  "status-cancelled",
  "status-overdue",
] as const;

const badgeSurfaceTokens = ["surface-container-lowest", "surface-container-low"] as const;

describe("global typography tokens", () => {
  it.each([
    ["title-lg", "1.5rem", "1.875rem", "700"],
    ["title-md", "1.25rem", "1.5rem", "700"],
    ["title-sm", "1.0625rem", "1.3125rem", "700"],
    ["body-sm", "0.875rem", "1.125rem", "400"],
    ["label-md", "0.9375rem", "1.25rem", "600"],
  ])("defines the %s scale", (name, size, lineHeight, weight) => {
    expect(css).toContain(`--text-${name}: ${size};`);
    expect(css).toContain(`--text-${name}--line-height: ${lineHeight};`);
    expect(css).toContain(`--text-${name}--font-weight: ${weight};`);
  });
});

describe("status color tokens", () => {
  it.each(statusTokens)("keeps %s badge text at WCAG AA contrast in every card state", (token) => {
    const foreground = readHexToken(token);

    for (const surfaceToken of badgeSurfaceTokens) {
      const tintedBackground = blend(foreground, readHexToken(surfaceToken), 0.15);
      expect(contrastRatio(foreground, tintedBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the solid Ready action legible with white text", () => {
    expect(contrastRatio(readHexToken("status-ready"), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });
});

type Rgb = readonly [number, number, number];

function readHexToken(token: string): Rgb {
  const match = css.match(new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6})`, "i"));

  if (!match?.[1]) {
    throw new Error(`Missing hex color token: ${token}`);
  }

  return hexToRgb(match[1]);
}

function hexToRgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
  ];
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([red, green, blue]: Rgb): number {
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
