interface StatusBadgeProps {
  status: string | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusClass = status === null ? "empty" : status.toLowerCase().replaceAll(" ", "-");

  return <span className={`atlas-status-badge is-${statusClass}`}>{status ?? "\u2014"}</span>;
}
