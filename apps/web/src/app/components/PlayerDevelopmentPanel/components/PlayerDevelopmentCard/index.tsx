import { PlayerDevelopmentPlayerSummary } from "@atlas/web/app/types";
import { EvidenceList } from "@atlas/web/app/components/EvidenceList";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { PlayerDevelopmentCardProps } from "./types";
import { Section } from "@atlas/web/app/components/Section";
import { IssueList } from "@atlas/web/app/components/IssueList";

function severityForDirection(
  direction: PlayerDevelopmentPlayerSummary["recentEvolution"]["direction"]
): "info" | "low" | "medium" | "high" {
  if (direction === "up") return "low";
  if (direction === "down") return "medium";
  return "info";
}

function labelDirection(direction: PlayerDevelopmentPlayerSummary["recentEvolution"]["direction"]) {
  if (direction === "up") return "subio";
  if (direction === "down") return "bajo";
  if (direction === "stable") return "estable";
  return "sin datos";
}

function formatSkillChange(previousValue: number | null, currentValue: number | null): string {
  if (previousValue === null || currentValue === null) {
    return `${previousValue ?? "?"} -> ${currentValue ?? "?"}`;
  }

  const delta = currentValue - previousValue;
  const prefix = delta > 0 ? "+" : "";

  return `${previousValue} -> ${currentValue} (${prefix}${delta})`;
}

export const PlayerDevelopmentCard = ({ player }: PlayerDevelopmentCardProps) => {
  return (
    <article className="finding-card development-card">
      <div className="finding-header">
        <div>
          <h3>{player.name}</h3>
          <p className="muted">
            {player.age} anos · {player.role.label} ({player.role.source})
          </p>
        </div>
        <span className={`severity ${severityForDirection(player.recentEvolution.direction)}`}>
          {labelDirection(player.recentEvolution.direction)}
        </span>
      </div>

      <dl className="summary-grid">
        <SummaryItem label="Subieron" value={player.recentEvolution.improvedSkills.toString()} />
        <SummaryItem label="Bajaron" value={player.recentEvolution.declinedSkills.toString()} />
        <SummaryItem
          label="Comparables"
          value={player.recentEvolution.comparableSkills.toString()}
        />
        <SummaryItem label="Confianza" value={player.recentEvolution.confidence} />
      </dl>

      <div className="skill-chip-list">
        {player.relevantSkills.map((skill) => (
          <span className="skill-chip" key={skill.skill}>
            {skill.skill}: {skill.value ?? "sin dato"}
          </span>
        ))}
      </div>

      <div className="skill-change-grid">
        {player.skillChanges.map((change) => (
          <span className={`skill-change ${change.direction}`} key={change.skill}>
            {change.skill}: {formatSkillChange(change.previousValue, change.currentValue)}
          </span>
        ))}
      </div>

      {player.warnings.length > 0 ? (
        <Section title="Advertencias del jugador" tone="warning">
          <IssueList issues={player.warnings} />
        </Section>
      ) : null}

      <div className="finding-list">
        {player.findings.map((finding) => (
          <article className="signal-card" key={finding.type}>
            <div className="finding-header">
              <strong>{finding.title}</strong>
              <span className={`severity ${finding.severity}`}>{finding.severity}</span>
            </div>
            <p className="muted">{finding.description}</p>
            <span className="confidence">Confianza: {finding.confidence}</span>
            <EvidenceList evidence={finding.evidence} />
          </article>
        ))}
      </div>
    </article>
  );
};
