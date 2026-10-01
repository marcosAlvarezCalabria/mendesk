export class OrderNotFoundError extends Error {
  constructor(message = "Order not found") {
    super(message);
    this.name = "OrderNotFoundError";
    Object.setPrototypeOf(this, OrderNotFoundError.prototype);
  }
}