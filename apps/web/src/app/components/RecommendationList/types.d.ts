import type { CurrencySettings, DiagnosticRecommendation } from "@atlas/web/app/types";

export interface RecommendationListProps {
  recommendations: DiagnosticRecommendation[];
  currency: CurrencySettings | null;
}
