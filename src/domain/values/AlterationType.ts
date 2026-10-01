export type AlterationType = "hem" | "waist" | "zipper" | "sleeves" | "take_in" | "other";

export const ALTERATION_TYPES: readonly AlterationType[] = ["hem", "waist", "zipper", "sleeves", "take_in", "other"];

export function toAlterationType(value: string): AlterationType {
  return ALTERATION_TYPES.includes(value as AlterationType) ? (value as AlterationType) : "other";
}
