import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";

export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Money {
    if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents < 0) {
      throw new InvalidMoneyError();
    }

    return new Money(cents);
  }

  static fromEuros(euros: number): Money {
    if (!Number.isFinite(euros) || euros < 0) {
      throw new InvalidMoneyError();
    }

    return new Money(Math.round(euros * 100));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return Money.fromCents(Math.max(0, this.cents - other.cents));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  toEuros(): number {
    return this.cents / 100;
  }

  toString(): string {
    return this.toEuros().toFixed(2);
  }
}
