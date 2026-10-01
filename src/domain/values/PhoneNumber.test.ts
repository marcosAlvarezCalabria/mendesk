import { describe, expect, it } from "vitest";

import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("PhoneNumber", () => {
  it("normalizes a local Irish number to international format", () => {
    expect(PhoneNumber.fromRaw("085 200 9225").value).toBe("353852009225");
  });

  it("normalizes a plus-prefixed Irish number", () => {
    expect(PhoneNumber.fromRaw("+353 85 200 9225").value).toBe("353852009225");
  });

  it("normalizes a 00-prefixed Irish number", () => {
    expect(PhoneNumber.fromRaw("00353852009225").value).toBe("353852009225");
  });

  it("keeps an already normalized Irish number unchanged", () => {
    expect(PhoneNumber.fromRaw("353852009225").value).toBe("353852009225");
  });

  it.each([
    ["+34 612 345 678", "34612345678"],
    ["0033 6 12 34 56 78", "33612345678"],
    ["380 (67) 123-45-67", "380671234567"],
    ["14155552671", "14155552671"],
  ])("normalizes an international number %s", (input, expected) => {
    expect(PhoneNumber.fromRaw(input).value).toBe(expected);
  });

  it("rejects an unassigned international calling code", () => {
    expect(() => PhoneNumber.fromRaw("+999 123 456 789")).toThrow(InvalidPhoneNumberError);
  });

  it.each(["084 123 4567", "085 123 456", "085 123 456 78"])(
    "rejects an Irish mobile number with the wrong length: %s",
    (input) => {
      expect(() => PhoneNumber.fromRaw(input)).toThrow(InvalidPhoneNumberError);
    },
  );

  it("rejects a North American number with an invalid area code", () => {
    expect(() => PhoneNumber.fromRaw("+1 123 555 2671")).toThrow(InvalidPhoneNumberError);
  });
  it("rejects too short numbers", () => {
    expect(() => PhoneNumber.fromRaw("123")).toThrow(InvalidPhoneNumberError);
  });

  it("rejects non-digit input", () => {
    expect(() => PhoneNumber.fromRaw("abc")).toThrow(InvalidPhoneNumberError);
  });

  it.each(["123456", "1234567890123456", "+0123456789", "+34 612 345 678 ext 4"])(
    "rejects an invalid international number %s",
    (input) => {
      expect(() => PhoneNumber.fromRaw(input)).toThrow(InvalidPhoneNumberError);
    },
  );
});
