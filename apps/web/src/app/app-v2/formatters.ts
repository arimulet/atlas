import { formatMoney } from "@atlas/web/app/formatters";
import type { MoneyTotal } from "@atlas/web/app/types";

export function formatV2Money(
  total: MoneyTotal | null,
  countryDetails?: { currencyName: string; currencyRate: number } | null
): string {
  return total === null ? "\u2014" : formatMoney(total, countryDetails);
}

export function formatV2Number(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US");
}

export function formatV2Percentage(value: number | null): string {
  return value === null
    ? "\u2014"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function formatV2Talent(value: number | null): string {
  return value === null ? "\u2014" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatV2Eta(value: number | null): string {
  if (value === null) {
    return "\u2014";
  }

  if (value < 1) {
    return "<1w";
  }

  return `~${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}w`;
}

export function formatV2DateTime(value: string | null): string {
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

export function formatV2Advanced(value: boolean): string {
  return value ? "\u2713" : "\u2014";
}
