import { describe, expect, it } from "vitest";

import { errorFallbackTexts } from "@/app/errorFallbackView";

describe("errorFallbackTexts", () => {
  it("returns Ukrainian recovery copy for the Ukrainian document locale", () => {
    expect(errorFallbackTexts("uk")).toEqual({
      title: "Щось пішло не так",
      description: "Не вдалося завантажити цю сторінку. Перевірте підключення та спробуйте ще раз.",
      tryAgain: "Спробувати ще раз",
      backToOrders: "Назад до замовлень",
    });
  });

  it("falls back to English for an unknown document locale", () => {
    expect(errorFallbackTexts("fr").title).toBe("Something went wrong");
  });
});
