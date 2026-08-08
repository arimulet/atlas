import { normalizeNullableString } from "../string/index.js";

export function validateSeason(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new Error("Operating season must be an integer between 1 and 999.");
  }

  return value;
}

export function validateWeek(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 16) {
    throw new Error("Operating week must be an integer between 1 and 16.");
  }

  return value;
}

export function validateCurrency(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value)?.toUpperCase() ?? null;

  if (normalized === null) {
    return null;
  }

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Operating currency must be a 3-letter ISO currency code.");
  }

  return normalized;
}
