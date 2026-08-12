import type { MoneyTotal } from "@atlas/web/app/types";

export function formatMoney(
  total: MoneyTotal | null | undefined,
  countryDetails?: { currencyName: string, currencyRate: number } | null
): string {
  if (!total) {
    return "Not available";
  }

  let value: string;
  if (countryDetails) {
    const convertedAmount = Math.round(total.amount * countryDetails.currencyRate);
    value = `${countryDetails.currencyName} ${convertedAmount.toLocaleString("en-US")}`;
  } else {
    value = `${total.currency ?? "mixed"} ${total.amount.toLocaleString("en-US")}`;
  }

  return total.isComplete ? value : `${value} (incomplete)`;
}

export function formatConvertedMoney(amount: number, countryDetails?: { currencyName: string, currencyRate: number } | null): string {
  if (countryDetails) {
    const convertedAmount = Math.round(amount * countryDetails.currencyRate);
    return `${countryDetails.currencyName} ${convertedAmount.toLocaleString("en-US")}`;
  }
  return `UNK ${amount.toLocaleString("en-US")}`;
}

export function formatNullable(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Not set" : value.toString();
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatLabel(value: string): string {
  return value
    .split(/[-.]/)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTrainingPriority(value: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not set";
  const mapping: Record<number, string> = {
    1: "Condicion",
    2: "Porteria",
    3: "Creacion",
    4: "Pases",
    5: "Tecnica",
    6: "Defensa",
    7: "Anotacion",
    8: "Rapidez"
  };
  return mapping[value] || value.toString();
}
