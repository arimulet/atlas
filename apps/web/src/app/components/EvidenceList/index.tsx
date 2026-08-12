import { formatNullable } from "@atlas/web/app/formatters";
import { EvidenceListProps } from "./types";
import { TraceKind } from "../TraceKind";

export const EvidenceList = ({ evidence }: EvidenceListProps) => {
  return (
    <ul className="issue-list">
      {evidence.map((item) => (
        <li key={`${item.kind}-${item.label}`}>
          <TraceKind type={item.kind} label={item.kind} />          
          <span>
            {item.label}: <strong>{formatNullable(item.value)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

