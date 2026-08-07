import { formatNullable } from "@atlas/web/app/formatters";
import { EvidenceListProps } from "./types";

export const EvidenceList = ({ evidence }: EvidenceListProps) => {
  return (
    <ul className="issue-list">
      {evidence.map((item) => (
        <li key={`${item.kind}-${item.label}`}>
          <span className={`trace-kind ${item.kind}`}>{item.kind}</span>
          <span>
            {item.label}: <strong>{formatNullable(item.value)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

