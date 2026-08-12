import { formatLabel } from "@atlas/web/app/formatters";
import { AssumptionList } from "@atlas/web/app/components/AssumptionList";
import { RecommendationList } from "@atlas/web/app/components/RecommendationList";
import { TraceList } from "@atlas/web/app/components/TraceList";
import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import type { DiagnosticPanelProps } from "./types";
import { Section } from "../Section";

export const DiagnosticPanel = ({ findingsByCategory, currency }: DiagnosticPanelProps) => {
  if (findingsByCategory.length === 0) {
    return null;
  }

  return (
    <Section title="Diagnostic" subtitle="Basic findings">
      <div className="finding-list">
        {findingsByCategory.map(([category, findings]) => (
          <section className="finding-group" key={category}>
            <h3>{formatLabel(category)}</h3>
            {findings.map((finding) => (
              <article className="finding-card" key={finding.code}>
                <div className="finding-header">
                  <span className={"severity " + finding.severity}>{finding.severity}</span>
                  <span className="confidence">Confidence: {finding.confidence}</span>
                </div>
                <p className="finding-description">
                  {describeDiagnosticFinding(finding, currency)}
                </p>
                <TraceList title="Evidence" traces={finding.evidence} currency={currency} />
                <AssumptionList assumptions={finding.assumptions} currency={currency} />
                <RecommendationList recommendations={finding.recommendations} currency={currency} />
                {finding.affectedPlayerIds.length > 0 ? (
                  <p className="affected">
                    Affected players: {finding.affectedPlayerIds.join(", ")}
                  </p>
                ) : null}
              </article>
            ))}
          </section>
        ))}
      </div>
    </Section>
  );
};
