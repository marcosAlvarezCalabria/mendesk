export type ParsedGarmentInput = {
  description: string;
  alterationType: string;
  measurements?: string;
  priceEuros: number;
  sourceIndex: number;
};

export const ALTERATION_TYPE_OPTIONS: readonly string[] = ["hem", "waist", "zipper", "sleeves", "take_in", "other"];

export function collectGarmentInputs(
  descriptions: readonly string[],
  types: readonly string[],
  measurements: readonly string[],
  prices: readonly string[],
): ParsedGarmentInput[] {
  const rowCount = Math.max(descriptions.length, types.length, measurements.length, prices.length);
  const garments: ParsedGarmentInput[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const description = (descriptions[index] ?? "").trim();
    const alterationType = types[index] ?? "";
    const measurement = (measurements[index] ?? "").trim();
    const price = prices[index] ?? "";

    if (!description && !measurement && !price) {
      continue;
    }

    garments.push({
      description,
      alterationType,
      measurements: measurement || undefined,
      priceEuros: price ? Number(price) : Number.NaN,
      sourceIndex: index,
    });
  }

  return garments;
}

export function parseDueDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}
