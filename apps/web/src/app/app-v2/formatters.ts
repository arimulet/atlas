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
