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

export function validateCurrency(
  value: { name: string; rate: number } | null | undefined
): { name: string; rate: number } {
  if (!value) {
    throw new Error("Currency is required.");
  }

  const name = normalizeNullableString(value.name);

  if (!name || typeof value.rate !== "number") {
    throw new Error("Currency must include a valid name and rate.");
  }

  return { name, rate: value.rate };
}
