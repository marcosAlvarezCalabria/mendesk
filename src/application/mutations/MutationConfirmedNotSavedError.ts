export class MutationConfirmedNotSavedError extends Error {
  constructor(options?: ErrorOptions) {
    super("The mutation was confirmed as not saved.", options);
    this.name = "MutationConfirmedNotSavedError";
  }
}
