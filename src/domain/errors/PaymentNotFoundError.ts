export class PaymentNotFoundError extends Error {
  constructor(message = "Payment not found") {
    super(message);
    this.name = "PaymentNotFoundError";
    Object.setPrototypeOf(this, PaymentNotFoundError.prototype);
  }
}
