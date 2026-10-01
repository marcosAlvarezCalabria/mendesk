export type MessageLocale = "en" | "uk";

const BUSINESS_NAME = "Koko Atelier";

export function buildReadyMessage(input: { clientName: string; locale: MessageLocale }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ваше замовлення в ${BUSINESS_NAME} готове до видачі. Чекаємо на вас!`;
  }

  return `Hi ${name}! Your order at ${BUSINESS_NAME} is ready for collection. See you soon!`;
}

export function buildReviewRequestMessage(input: {
  clientName: string;
  reviewUrl: string;
  locale: MessageLocale;
}): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Дякуємо, що обрали ${BUSINESS_NAME}. Будемо вдячні за ваш відгук: ${input.reviewUrl}`;
  }

  return `Hi ${name}, thank you for choosing ${BUSINESS_NAME}! We'd love your feedback — please leave us a review: ${input.reviewUrl}`;
}

export function buildIntakeConfirmationMessage(input: { clientName: string; locale: MessageLocale }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ми прийняли ваші речі в ${BUSINESS_NAME}. Повідомимо, щойно все буде готове. Дякуємо!`;
  }

  return `Hi ${name}, we've received your garments at ${BUSINESS_NAME}. We'll let you know as soon as they're ready. Thank you!`;
}

function normalizeName(clientName: string): string {
  return clientName.trim();
}