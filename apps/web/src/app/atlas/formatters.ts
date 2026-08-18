import { formatMoney as formatSourceMoney } from "@atlas/web/app/formatters";
import type { MoneyTotal } from "@atlas/web/app/types";

export function formatMoney(
  total: MoneyTotal | null,
  countryDetails?: { currencyName: string; currencyRate: number } | null
): string {
  return total === null ? "\u2014" : formatSourceMoney(total, countryDetails);
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
