export class LastGarmentRemovalError extends Error {
  constructor(message = "An order must keep at least one garment") {
    super(message);
    this.name = "LastGarmentRemovalError";
    Object.setPrototypeOf(this, LastGarmentRemovalError.prototype);
  }
}
