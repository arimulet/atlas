import { formatLabel } from "../formatters";
import type { DiagnosticFinding } from "../types";
import { AssumptionList, TraceList } from "./TraceList";

export interface DiagnosticPanelProps {
  findingsByCategory: Array<[string, DiagnosticFinding[]]>;
}

export function DiagnosticPanel({ findingsByCategory }: DiagnosticPanelProps) {
  if (findingsByCategory.length === 0) {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Diagnostic</p>
        <h2>Basic findings</h2>
      </div>
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
    </section>
  );
}
