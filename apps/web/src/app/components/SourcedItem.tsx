import { formatNullable } from "../formatters";
import type { SourceKind } from "../types";

export interface SourcedItemProps {
  label: string;
  value: string | number | null;
  source: SourceKind;
}

export function SourcedItem({ label, value, source }: SourcedItemProps) {
  return (
    <div className="source-item">
      <dt>
        {label}
        <span className={`trace-kind ${source}`}>{source}</span>
      </dt>
      <dd>{formatNullable(value)}</dd>
    </div>
  );
}
