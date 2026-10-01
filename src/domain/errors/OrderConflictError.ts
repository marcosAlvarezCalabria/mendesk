export class OrderConflictError extends Error {
  constructor() {
    super("The order changed before this update could be saved.");
    this.name = "OrderConflictError";
  }
}
