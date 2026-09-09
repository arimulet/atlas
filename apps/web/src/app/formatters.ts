import type { MoneyTotal } from "@atlas/web/app/types";

export type DiagnosticParameterValue = string | number | boolean | null;

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

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "\u2014" : value.toLocaleString("en-US");
}

export function formatPercentage(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "\u2014"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function formatTalent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatAge(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

export interface FormatWeeksOptions {
  unit?: "short" | "long";
  fallback?: string;
}

export function formatWeeks(
  value: number | null | undefined,
  options?: FormatWeeksOptions
): string {
  const fallback = options?.fallback ?? "—";
  if (value === null || value === undefined) {
    return fallback;
  }

  if (options?.unit === "long") {
    if (value < 1) {
      return "less than one week";
    }
    const rounded = Math.round(value * 10) / 10;
    return `~${rounded} weeks`;
  }

  if (value > 0 && value < 1) {
    return "<1w";
  }

  return `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

export const formatEta = formatWeeks;

export function formatSignedWeeks(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

export function capitalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatGameWeek(value: number | null | undefined, fallback = "Unknown"): string {
  return value === null || value === undefined ? fallback : `~GW ${value}`;
}

export function formatRank(value: number | null | undefined, fallback = "Unknown"): string {
  return value === null || value === undefined ? fallback : `#${value}`;
}

export function formatDate(
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—"
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString("en-US", options);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === null || value === undefined) {
    return "\u2014";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "\u2014";
  }

  return date.toLocaleString("en-US", options ?? {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatBooleanCheck(value: boolean | null | undefined): string {
  return value ? "\u2713" : "\u2014";
}

export const formatAdvanced = formatBooleanCheck;

export function formatDiagnosticNumber(
  value: DiagnosticParameterValue | undefined
): string {
  if (typeof value === "number") {
    return value.toLocaleString("es-AR");
  }
  if (value === null || value === undefined) {
    return "dato no disponible";
  }
  return String(value);
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
