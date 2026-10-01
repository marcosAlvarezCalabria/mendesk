export class DirectusMappingError extends Error {
  constructor(message = "Invalid Directus record") {
    super(message);
    this.name = "DirectusMappingError";
    Object.setPrototypeOf(this, DirectusMappingError.prototype);
  }
}