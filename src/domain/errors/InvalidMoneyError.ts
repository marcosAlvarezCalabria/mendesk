export class InvalidMoneyError extends Error {
  constructor(message = "Invalid money amount") {
    super(message);
    this.name = "InvalidMoneyError";
    Object.setPrototypeOf(this, InvalidMoneyError.prototype);
  }
}
