import { describeDiagnosticTrace } from "@atlas/web/app/diagnostic-copy";
import { DetailBlock } from "../DetailBlock";
import { TraceKind } from "../TraceKind";
import type { TraceListProps } from "./types";

export const TraceList = ({ title, traces, currency }: TraceListProps) => {
  return (
    <DetailBlock title={title}>
      <ul>
        {traces.map((trace) => (
          <li key={trace.kind + "-" + trace.code + "-" + trace.value}>
            <TraceKind type={trace.kind} label={trace.kind} />
            <span>{describeDiagnosticTrace(trace, currency)}</span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
};
