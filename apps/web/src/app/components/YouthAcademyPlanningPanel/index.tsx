import { useState } from "react";
import { SummaryItem } from "@atlas/web/app/components/SummaryItem";
import { Section } from "@atlas/web/app/components/Section";
import { IssueList } from "@atlas/web/app/components/IssueList";
import { YouthAcademyPlanningPanelProps } from "./types";
import type { RealYouthAcademyCategory, RealYouthAcademyPlayerPlan } from "@atlas/web/app/types";

export const YouthAcademyPlanningPanel = ({
  realYouthAcademyPlanning,
  status,
  onBack
}: YouthAcademyPlanningPanelProps) => {
  const [filterCategory, setFilterCategory] = useState<RealYouthAcademyCategory | "all">("all");

  if (status === "loading") {
    return <Section description="Cargando Escuela Juvenil (Cantera Real)..." />;
  }

  if (status === "error" || !realYouthAcademyPlanning) {
    return (
      <Section
        tone="error"
        title="Escuela Juvenil (Cantera Real)"
        subtitle="No se pudo cargar el modulo"
        description="Volver al dashboard e intentar nuevamente."
      >
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </Section>
    );
  }

  const { observed, manual, derived, warnings } = realYouthAcademyPlanning;
  const academyInvestment = manual?.academyInvestment ?? "balanced";

  const filteredPlayers =
    filterCategory === "all"
      ? derived.players
      : derived.players.filter((p) => p.category === filterCategory);

  return (
    <section className="squad-market-view">
      <div className="module-topbar">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>Escuela Juvenil (Cantera Real)</h2>
        </div>
        <button type="button" onClick={onBack}>
          Volver al dashboard
        </button>
      </div>

      <Section
        title="Escuela Juvenil de Sokker"
        subtitle="Formacion de juveniles fuera del plantel senior"
        description="Este modulo analiza la cantera real del club: semanas en la escuela, proyeccion de ascenso al primer equipo y estimacion de talento."
      />

      <section className="economy-columns">
        <Section title="Observado" subtitle="Cantera real exportada">
          <dl className="summary-grid">
            <SummaryItem
              label="Snapshot Date"
              value={realYouthAcademyPlanning.snapshotDate ?? "No disponible"}
            />
            <SummaryItem
              label="Total Juveniles"
              value={observed.coverage.totalYouthCount.toString()}
            />
            <SummaryItem
              label="Con proyeccion"
              value={observed.coverage.youthsWithWeeksRemaining.toString()}
            />
            <SummaryItem
              label="Con skill"
              value={observed.coverage.youthsWithSkill.toString()}
            />
            <SummaryItem label="Origen" value={observed.source} />
          </dl>
        </Section>

        <Section title="Manual" subtitle="Preferencia del club">
          <dl className="summary-grid">
            <SummaryItem label="academy.investment" value={academyInvestment} />
            <SummaryItem label="Origen de datos" value="Cantera real (Sokker DOM)" />
          </dl>
        </Section>
      </section>

      <Section title="Derivado" subtitle="Resumen de categorias de cantera">
        <dl className="summary-grid">
          <SummaryItem
            label="Listo p/ Promocion"
            value={derived.categoryCounts.ready_for_promotion.toString()}
          />
          <SummaryItem
            label="Prospecto Destacado"
            value={derived.categoryCounts.standout_prospect.toString()}
          />
          <SummaryItem
            label="Riesgo Estancamiento"
            value={derived.categoryCounts.stagnation_risk.toString()}
          />
          <SummaryItem
            label="Seguimiento"
            value={derived.categoryCounts.follow_up.toString()}
          />
          <SummaryItem
            label="Datos Insuficientes"
            value={derived.categoryCounts.insufficient_data.toString()}
          />
        </dl>
      </Section>

      {warnings.length > 0 ? (
        <Section title="Advertencias del modulo" tone="warning">
          <IssueList issues={warnings} />
        </Section>
      ) : null}

      <Section
        title="Juveniles en Cantera"
        subtitle={`Mostrando ${filteredPlayers.length} de ${derived.players.length} juveniles`}
      >
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={filterCategory === "all" ? "primary" : "secondary"}
            onClick={() => setFilterCategory("all")}
          >
            Todos ({derived.players.length})
          </button>
          <button
            type="button"
            className={filterCategory === "ready_for_promotion" ? "primary" : "secondary"}
            onClick={() => setFilterCategory("ready_for_promotion")}
          >
            Listo p/ Ascenso ({derived.categoryCounts.ready_for_promotion})
          </button>
          <button
            type="button"
            className={filterCategory === "standout_prospect" ? "primary" : "secondary"}
            onClick={() => setFilterCategory("standout_prospect")}
          >
            Destacados ({derived.categoryCounts.standout_prospect})
          </button>
          <button
            type="button"
            className={filterCategory === "stagnation_risk" ? "primary" : "secondary"}
            onClick={() => setFilterCategory("stagnation_risk")}
          >
            Riesgo Estancamiento ({derived.categoryCounts.stagnation_risk})
          </button>
          <button
            type="button"
            className={filterCategory === "follow_up" ? "primary" : "secondary"}
            onClick={() => setFilterCategory("follow_up")}
          >
            Seguimiento ({derived.categoryCounts.follow_up})
          </button>
        </div>

        <div className="development-list">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <RealYouthPlayerCard key={player.id} player={player} />
            ))
          ) : (
            <p className="muted">No hay juveniles que coincidan con el filtro seleccionado.</p>
          )}
        </div>
      </Section>
    </section>
  );
};

function RealYouthPlayerCard({ player }: { player: RealYouthAcademyPlayerPlan }) {
  const categoryLabels: Record<RealYouthAcademyCategory, string> = {
    ready_for_promotion: "Listo para Promoción",
    standout_prospect: "Prospecto Destacado",
    stagnation_risk: "Riesgo de Estancamiento",
    follow_up: "En Seguimiento",
    insufficient_data: "Datos Insuficientes"
  };

  const categoryTones: Record<RealYouthAcademyCategory, string> = {
    ready_for_promotion: "status-pill success",
    standout_prospect: "status-pill success",
    stagnation_risk: "status-pill warning",
    follow_up: "status-pill info",
    insufficient_data: "status-pill muted"
  };

  return (
    <article className="player-development-card">
      <header className="card-header">
        <div>
          <h3>{player.name}</h3>
          <p className="muted">
            Edad actual: {player.age} años
            {player.projectedPromotionAge !== null
              ? ` · Ascenso proyectado a los ${player.projectedPromotionAge} años`
              : ""}
          </p>
        </div>
        <span className={categoryTones[player.category]}>{categoryLabels[player.category]}</span>
      </header>

      <div className="summary-grid" style={{ marginTop: "0.75rem" }}>
        <SummaryItem
          label="Semanas en escuela"
          value={player.weeksInAcademy !== null ? `${player.weeksInAcademy} sem.` : "No inf."}
        />
        <SummaryItem
          label="Semanas para ascenso"
          value={player.weeksRemaining !== null ? `${player.weeksRemaining} sem.` : "No inf."}
        />
        <SummaryItem label="Skill" value={player.skill?.toString() ?? "No inf."} />
        <SummaryItem label="Estado de cantera" value={player.status} />
      </div>

      <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>{player.rationale}</p>

      {player.signals.length > 0 ? (
        <div style={{ marginTop: "0.5rem" }}>
          {player.signals.map((sig) => (
            <p key={sig.code} className="muted" style={{ fontSize: "0.85rem" }}>
              • {sig.message}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
