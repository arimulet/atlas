import { TraceListProps } from "./types";

export const TraceList = ({ title, traces }: TraceListProps) => {
  return (
    <div className="detail-block">
      <h4>{title}</h4>
      <ul>
        {traces.map((trace) => (
          <li key={`${trace.kind}-${trace.label}-${trace.value}`}>
            <span className={`trace-kind ${trace.kind}`}>{trace.kind}</span>
            <span>
              {trace.label}
              {trace.value !== null ? `: ${trace.value}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

