import type { MoneyTotal } from "@atlas/web/app/types";

export function formatMoney(
  total: MoneyTotal | null,
  countryDetails?: { currencyName: string; currencyRate: number } | null
): string {
  if (total === null) {
    return "\u2014";
  }

  let value: string;

  if (countryDetails) {
    const convertedAmount = Math.round(total.amount / countryDetails.currencyRate);
    value = `${countryDetails.currencyName} ${convertedAmount.toLocaleString("en-US")}`;
  } else {
    value = `${total.currency ?? "mixed"} ${total.amount.toLocaleString("en-US")}`;
  }

  return total.isComplete ? value : `${value} (incomplete)`;
}

export function formatNumber(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US");
}

export function formatPercentage(value: number | null): string {
  return value === null
    ? "\u2014"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function formatTalent(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatEta(value: number | null): string {
  if (value === null) {
    return "\u2014";
  }

  if (value < 1) {
    return "<1w";
  }

  return `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

export function formatDateTime(value: string | null): string {
  if (value === null) {
    return "\u2014";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatAdvanced(value: boolean): string {
  return value ? "\u2713" : "\u2014";
}

export function formatTrainingPriority(value: number): string {
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

  return mapping[value] ?? value.toString();
}
