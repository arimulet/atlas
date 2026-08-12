import { describeDiagnosticRecommendation } from "@atlas/web/app/diagnostic-copy";
import { DetailBlock } from "../DetailBlock";
import { TraceKind } from "../TraceKind";
import type { RecommendationListProps } from "./types";

export const RecommendationList = ({ recommendations, currency }: RecommendationListProps) => {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <DetailBlock title="Recommendations">
      <ul>
        {recommendations.map((recommendation) => (
          <li key={recommendation.code}>
            <TraceKind label={recommendation.traceKind} type="recommended" />
            <span>{describeDiagnosticRecommendation(recommendation, currency)}</span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
};
