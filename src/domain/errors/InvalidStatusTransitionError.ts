export class InvalidStatusTransitionError extends Error {
  constructor(message = "Invalid status transition") {
    super(message);
    this.name = "InvalidStatusTransitionError";
    Object.setPrototypeOf(this, InvalidStatusTransitionError.prototype);
  }
}
