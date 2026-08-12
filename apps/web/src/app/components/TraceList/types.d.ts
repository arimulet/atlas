import type { CurrencySettings, DiagnosticTrace } from "@atlas/web/app/types";

export interface TraceListProps {
  title: string;
  traces: DiagnosticTrace[];
  currency: CurrencySettings | null;
}
