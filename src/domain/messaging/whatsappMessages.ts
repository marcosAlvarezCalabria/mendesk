export type MessageLocale = "en" | "uk";

export function buildReadyMessage(input: { clientName: string; locale: MessageLocale; storeName: string }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ваше замовлення в ${input.storeName} готове до видачі. Чекаємо на вас!`;
  }

  return `Hi ${name}! Your order at ${input.storeName} is ready for collection. See you soon!`;
}

export function buildReviewRequestMessage(input: {
  clientName: string;
  reviewUrl: string;
  locale: MessageLocale;
  storeName: string;
}): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Дякуємо, що обрали ${input.storeName}. Будемо вдячні за ваш відгук: ${input.reviewUrl}`;
  }

  return `Hi ${name}, thank you for choosing ${input.storeName}! We'd love your feedback — please leave us a review: ${input.reviewUrl}`;
}

export function buildIntakeConfirmationMessage(input: { clientName: string; locale: MessageLocale; storeName: string }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ми прийняли ваші речі в ${input.storeName}. Повідомимо, щойно все буде готове. Дякуємо!`;
  }

  return `Hi ${name}, we've received your garments at ${input.storeName}. We'll let you know as soon as they're ready. Thank you!`;
}

function normalizeName(clientName: string): string {
  return clientName.trim();
}
