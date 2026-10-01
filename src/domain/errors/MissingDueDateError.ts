export class MissingDueDateError extends Error {
  constructor(message = "Missing due date") {
    super(message);
    this.name = "MissingDueDateError";
    Object.setPrototypeOf(this, MissingDueDateError.prototype);
  }
}