import { formatNullable } from "@atlas/web/app/formatters";
import { SquadMarketPlayerPlan } from "@atlas/web/app/types";
import { EvidenceList } from "@atlas/web/app/components/EvidenceList";
import { IssuePanel } from "@atlas/web/app/components/IssuePanel";
import { TimingList } from "@atlas/web/app/components/SquadMarketPlanningPanel/components/TimingList";
import { MarketPlayerCardProps } from "./types";


function labelCategory(category: SquadMarketPlayerPlan["category"]): string {
  if (category === "sale_candidate") return "venta";
  if (category === "protection_candidate") return "proteccion";
  if (category === "follow_up") return "seguimiento";
  return "sin senal";
}


export const MarketPlayerCard = ({ player }: MarketPlayerCardProps) => {
  return (
    <article className="finding-card development-card">
      <div className="finding-header">
        <div>
          <h3>{player.name}</h3>
          <p className="muted">
            {player.age} anos - {player.role.label} ({player.role.source})
          </p>
        </div>
        <span className={`severity ${player.severity}`}>{labelCategory(player.category)}</span>
      </div>
      <p className="muted">{player.rationale}</p>
      <div className="trace-row">
        <span className="confidence">Confianza: {player.confidence}</span>
        <span className="confidence">Timing: {player.timing.label}</span>
        <span className="confidence">
          Ventana: {formatNullable(player.timing.window.from)} a{" "}
          {formatNullable(player.timing.window.to)} ({player.timing.window.snapshotCount})
        </span>
      </div>

      <div className="market-timing-grid">
        <TimingList title="Datos usados" items={player.timing.dataUsed} />
        <TimingList title="Razones principales" items={player.timing.mainReasons} />
        <TimingList title="Limites" items={player.timing.limits} />
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
            <div className="finding-header">
              <strong>{signal.message}</strong>
              <span className={`severity ${signal.severity}`}>{signal.severity}</span>
            </div>
            <span className="confidence">Confianza: {signal.confidence}</span>
            <EvidenceList evidence={signal.evidence} />
          </article>
        ))}
      </div>
    </article>
  );
}
