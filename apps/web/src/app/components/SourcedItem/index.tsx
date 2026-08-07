import { formatNullable } from "../../formatters";
import { SourcedItemProps } from "./types";

export const SourcedItem = ({ label, value, source }: SourcedItemProps) => {
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
