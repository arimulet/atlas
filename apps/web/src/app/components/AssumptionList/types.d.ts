import type { CurrencySettings, DiagnosticAssumption } from "@atlas/web/app/types";

export interface AssumptionListProps {
  assumptions: DiagnosticAssumption[];
  currency: CurrencySettings | null;
}
