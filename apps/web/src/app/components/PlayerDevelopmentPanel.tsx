import type {
  PlayerDevelopment,
  PlayerDevelopmentEvidence,
  PlayerDevelopmentPlayerSummary,
} from "../types";
import { IssuePanel } from "./IssuePanel";
import { SummaryItem } from "./SummaryItem";

export interface PlayerDevelopmentPanelProps {
  playerDevelopment: PlayerDevelopment | null;
  status: "idle" | "loading" | "ready" | "error";
  onBack: () => void;
}

export function PlayerDevelopmentPanel({
  playerDevelopment,
  status,
  onBack
}: PlayerDevelopmentPanelProps) {
  if (status === "loading") {
    return (
      <section className="panel">
        <p className="loading">Cargando desarrollo de jugadores...</p>
      </section>
    );
  }

  if (status === "error" || !playerDevelopment) {
    return (
      <section className="panel issue-panel error">
        <div className="panel-heading">
          <p className="eyebrow">Desarrollo de jugadores</p>
          <h2>No se pudo cargar el modulo</h2>
        </div>
        <p className="muted">Volver al dashboard e intentar nuevamente.</p>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="player-development-view">
      <div className="module-topbar">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>Desarrollo de jugadores</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Alcance</p>
          <h2>Evolucion observada de habilidades</h2>
        </div>
        <p className="muted">
          Esta vista compara habilidades visibles entre snapshots historicos. La prioridad de
          entrenamiento aparece como contexto manual y no como prueba causal de las mejoras.
        </p>
      </section>

      <section className="development-columns">
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Observado</p>
            <h2>Historial disponible</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem label="Snapshots" value={playerDevelopment.snapshotCount.toString()} />
            <SummaryItem
              label="Ultimo snapshot"
              value={playerDevelopment.observed.latestSnapshotDate ?? "No disponible"}
            />
            <SummaryItem
              label="Jugadores"
              value={playerDevelopment.observed.players.length.toString()}
            />
          </dl>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Manual</p>
            <h2>Contexto del club</h2>
          </div>
          <dl className="summary-grid">
            <SummaryItem
              label="training.priority"
              value={playerDevelopment.manual.trainingPriority}
            />
            <SummaryItem label="Causalidad" value="No atribuida" />
          </dl>
        </section>
      </section>

      {playerDevelopment.warnings.length > 0 ? (
        <IssuePanel
          title="Advertencias del modulo"
          tone="warning"
          issues={playerDevelopment.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Derivado por jugador</p>
          <h2>Evolucion reciente</h2>
        </div>
        <div className="development-list">
          {playerDevelopment.derived.players.map((player) => (
            <PlayerDevelopmentCard key={player.playerId ?? player.name} player={player} />
          ))}
        </div>
      </section>
    </section>
  );
}

function PlayerDevelopmentCard({ player }: { player: PlayerDevelopmentPlayerSummary }) {
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
        <IssuePanel
          title="Advertencias del jugador"
          tone="warning"
          issues={player.warnings.map((warning) => ({
            path: warning.code,
            message: warning.message
          }))}
        />
      ) : null}

      <div className="finding-list">
        {player.signals.map((signal) => (
          <article className="signal-card" key={signal.code}>
            <strong>{signal.message}</strong>
            <span className="confidence">Confianza: {signal.confidence}</span>
            <EvidenceList evidence={signal.evidence} />
          </article>
        ))}
      </div>
    </article>
  );
}

function EvidenceList({ evidence }: { evidence: PlayerDevelopmentEvidence[] }) {
  return (
    <ul className="issue-list">
      {evidence.map((item) => (
        <li key={`${item.kind}-${item.label}`}>
          <span className={`trace-kind ${item.kind}`}>{item.kind}</span>
          <span>
            {item.label}: <strong>{item.value ?? "No disponible"}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

function labelDirection(direction: PlayerDevelopmentPlayerSummary["recentEvolution"]["direction"]) {
  if (direction === "up") return "subio";
  if (direction === "down") return "bajo";
  if (direction === "stable") return "estable";
  return "sin datos";
}

function severityForDirection(
  direction: PlayerDevelopmentPlayerSummary["recentEvolution"]["direction"]
): "info" | "low" | "medium" | "high" {
  if (direction === "up") return "low";
  if (direction === "down") return "medium";
  return "info";
}

function formatSkillChange(previousValue: number | null, currentValue: number | null): string {
  if (previousValue === null || currentValue === null) {
    return `${previousValue ?? "?"} -> ${currentValue ?? "?"}`;
  }

  const delta = currentValue - previousValue;
  const prefix = delta > 0 ? "+" : "";

  return `${previousValue} -> ${currentValue} (${prefix}${delta})`;
}

