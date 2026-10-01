export class InvalidOrderNumberError extends Error {
  constructor(message = "Invalid order number") {
    super(message);
    this.name = "InvalidOrderNumberError";
    Object.setPrototypeOf(this, InvalidOrderNumberError.prototype);
  }
}
