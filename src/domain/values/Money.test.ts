import { describe, expect, it } from "vitest";

import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { Money } from "@/domain/values/Money";

describe("Money", () => {
  it("creates money from euros and cents", () => {
    expect(Money.fromEuros(25).cents).toBe(2500);
    expect(Money.fromCents(2500).toEuros()).toBe(25);
  });

  it("rounds euros to whole cents", () => {
    expect(Money.fromEuros(25.555).cents).toBe(2556);
  });

  it("adds two money values", () => {
    const result = Money.fromEuros(30).add(Money.fromEuros(25));

    expect(result.toString()).toBe("55.00");
  });

  it("subtracts money values", () => {
    const result = Money.fromEuros(30).subtract(Money.fromEuros(10));

    expect(result.toString()).toBe("20.00");
  });

  it("clamps subtraction at zero", () => {
    const result = Money.fromEuros(10).subtract(Money.fromEuros(30));

    expect(result.isZero()).toBe(true);
  });

  it("rejects invalid amounts", () => {
    expect(() => Money.fromEuros(-1)).toThrow(InvalidMoneyError);
    expect(() => Money.fromCents(2.5)).toThrow(InvalidMoneyError);
  });

  it("formats euros with two decimal places", () => {
    expect(Money.fromEuros(5).toString()).toBe("5.00");
  });
});
