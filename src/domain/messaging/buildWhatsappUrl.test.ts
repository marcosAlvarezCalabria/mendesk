import { describe, expect, it } from "vitest";

import { buildWhatsappUrl } from "@/domain/messaging/buildWhatsappUrl";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("buildWhatsappUrl", () => {
  it("builds a wa.me URL with an encoded message", () => {
    expect(buildWhatsappUrl(PhoneNumber.fromRaw("353852009225"), "Hello world")).toBe(
      "https://wa.me/353852009225?text=Hello%20world",
    );
  });

  it("percent-encodes Cyrillic and accented text without raw spaces", () => {
    const result = buildWhatsappUrl(PhoneNumber.fromRaw("353852009225"), "Ваше замовлення готове");

    expect(result).toContain("%D0");
    expect(result).not.toContain(" ");
  });

  it("keeps the text query parameter when the message is empty", () => {
    expect(buildWhatsappUrl(PhoneNumber.fromRaw("353852009225"), "")).toBe("https://wa.me/353852009225?text=");
  });
});