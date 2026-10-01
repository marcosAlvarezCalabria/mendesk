import { InvalidOrderNumberError } from "@/domain/errors/InvalidOrderNumberError";

export class OrderNumber {
  private constructor(readonly value: string) {}

  static fromString(value: string): OrderNumber {
    const trimmed = value.trim();

    if (!/^\d{6}-\d+$/.test(trimmed)) {
      throw new InvalidOrderNumberError();
    }

    return new OrderNumber(trimmed);
  }

  static compose(receivedDate: Date, sequence: number): OrderNumber {
    if (!isValidDate(receivedDate) || !Number.isInteger(sequence) || sequence < 1) {
      throw new InvalidOrderNumberError();
    }

    const year = String(receivedDate.getUTCFullYear()).slice(-2).padStart(2, "0");
    const month = String(receivedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(receivedDate.getUTCDate()).padStart(2, "0");
    const paddedSequence = String(sequence).padStart(4, "0");

    return new OrderNumber(`${year}${month}${day}-${paddedSequence}`);
  }

  toString(): string {
    return this.value;
  }
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
