export class GarmentNotFoundError extends Error {
  constructor(message = "Garment not found in order") {
    super(message);
    this.name = "GarmentNotFoundError";
    Object.setPrototypeOf(this, GarmentNotFoundError.prototype);
  }
}
