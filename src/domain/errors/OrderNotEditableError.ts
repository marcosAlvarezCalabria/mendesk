export class OrderNotEditableError extends Error {
  constructor(message = "Order is not editable") {
    super(message);
    this.name = "OrderNotEditableError";
    Object.setPrototypeOf(this, OrderNotEditableError.prototype);
  }
}