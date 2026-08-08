import { formatLabel } from "@atlas/web/app/formatters";
import { AssumptionList } from "@atlas/web/app/components/AssumptionList";
import { TraceList } from "@atlas/web/app/components/TraceList";
import { DiagnosticPanelProps } from "./types";
import { Section } from "../Section";

export const DiagnosticPanel = ({ findingsByCategory }: DiagnosticPanelProps) => {
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
                  <span className={`severity ${finding.severity}`}>{finding.severity}</span>
                  <span className="confidence">Confidence: {finding.confidence}</span>
                </div>
                <p className="finding-description">{finding.description}</p>
                <TraceList title="Evidence" traces={finding.evidence} />
                <AssumptionList assumptions={finding.assumptions} />
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
