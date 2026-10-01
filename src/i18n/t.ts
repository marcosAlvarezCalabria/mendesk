import { en } from "@/i18n/dictionaries/en";
import type { DictKey } from "@/i18n/dictionaries";

export function t(dict: Record<DictKey, string>, key: DictKey, vars?: Record<string, string>): string {
  const translation = dict[key] || en[key] || key;

  return translation.replace(/\{([^}]+)\}/g, (placeholder, variableName: string) => vars?.[variableName] ?? placeholder);
}
