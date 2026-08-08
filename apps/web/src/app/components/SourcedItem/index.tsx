import { formatNullable } from "@atlas/web/app/formatters";
import { SourcedItemProps } from "./types";
import { TraceKind } from "../TraceKind";

export const SourcedItem = ({ label, value, source }: SourcedItemProps) => {
  return (
    <div className="source-item">
      <dt>
        {label}
        <TraceKind type={source} label={source} />
      </dt>
      <dd>{formatNullable(value)}</dd>
    </div>
  );
};
