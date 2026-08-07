import { AssumptionListProps } from "./types";

export const AssumptionList = ({ assumptions }: AssumptionListProps) => {
  return (
    <div className="detail-block">
      <h4>Assumptions</h4>
      <ul>
        {assumptions.map((assumption) => (
          <li key={assumption.code}>
            <span className="trace-kind assumed">{assumption.traceKind}</span>
            <span>{assumption.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}