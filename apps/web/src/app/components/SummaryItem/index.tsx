import { SummaryItemProps } from "./types";

export const SummaryItem = ({ label, value }: SummaryItemProps) => {
  return (
    <div className="summary-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
