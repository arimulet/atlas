import type { MoneyTotal } from "./types";

export function formatMoney(total: MoneyTotal): string {
  const value = `${total.currency ?? "mixed"} ${total.amount.toLocaleString("en-US")}`;

  return total.isComplete ? value : `${value} (incomplete)`;
}

export function formatNullable(value: string | number | null): string {
  return value === null || value === "" ? "Not set" : value.toString();
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
