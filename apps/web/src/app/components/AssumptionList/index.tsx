import { describeDiagnosticAssumption } from "@atlas/web/app/diagnostic-copy";
import { DetailBlock } from "../DetailBlock";
import { TraceKind } from "../TraceKind";
import type { AssumptionListProps } from "./types";

export const AssumptionList = ({ assumptions, currency }: AssumptionListProps) => {
  return (
    <DetailBlock title="Assumptions">
      <ul>
        {assumptions.map((assumption) => (
          <li key={assumption.code}>
            <TraceKind label={assumption.traceKind} type="assumed" />
            <span>{describeDiagnosticAssumption(assumption, currency)}</span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
};
