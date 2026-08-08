import { TraceKindProps } from "./types";

export const TraceKind = ({ label, type }: TraceKindProps) => (
  <span className={`trace-kind ${type}`}>{label}</span>
);
