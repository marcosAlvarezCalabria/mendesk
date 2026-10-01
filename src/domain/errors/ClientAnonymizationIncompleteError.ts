export class ClientAnonymizationIncompleteError extends Error {
  constructor(readonly remainingPhotoCount: number) {
    super("Client anonymization is incomplete");
    this.name = "ClientAnonymizationIncompleteError";
    Object.setPrototypeOf(this, ClientAnonymizationIncompleteError.prototype);
  }
}
