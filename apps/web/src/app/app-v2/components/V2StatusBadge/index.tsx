interface V2StatusBadgeProps {
  status: string | null;
}

export function V2StatusBadge({ status }: V2StatusBadgeProps) {
  const statusClass = status === null ? "empty" : status.toLowerCase().replaceAll(" ", "-");

  return <span className={`v2-status-badge is-${statusClass}`}>{status ?? "\u2014"}</span>;
}
