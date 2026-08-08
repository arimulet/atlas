import { DetailBlock } from "../DetailBlock";
import { TraceKind } from "../TraceKind";
import { TraceListProps } from "./types";

export const TraceList = ({ title, traces }: TraceListProps) => {
  return (
    <DetailBlock title={title}>
      <ul>
        {traces.map((trace) => (
          <li key={`${trace.kind}-${trace.label}-${trace.value}`}>
            <TraceKind type={trace.kind} label={trace.kind} />
            <span>
              {trace.label}
              {trace.value !== null ? `: ${trace.value}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
};
