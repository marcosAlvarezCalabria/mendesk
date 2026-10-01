export class ConcurrentGarmentModificationError extends Error {
  constructor(message = "Garment was changed by another user") {
    super(message);
    this.name = "ConcurrentGarmentModificationError";
    Object.setPrototypeOf(this, ConcurrentGarmentModificationError.prototype);
  }
}
