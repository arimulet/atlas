import { DetailBlock } from "../DetailBlock";
import { TraceKind } from "../TraceKind";
import { AssumptionListProps } from "./types";

export const AssumptionList = ({ assumptions }: AssumptionListProps) => {
  return (
    <DetailBlock title="Assumptions">
      <ul>
        {assumptions.map((assumption) => (
          <li key={assumption.code}>
            <TraceKind label={assumption.traceKind} type="assumed" />
            <span>{assumption.description}</span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
};
