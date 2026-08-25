import { Component, type ReactNode } from "react";
import type { PlayerDetailProps } from "./types";
import { ProjectionPanel } from "./ProjectionPanel";
import { formatDateTime, formatNumber, formatPercentage } from "../../formatters";
import { CountryNameFlag } from "../../components/CountryNameFlag";
import { DiagnosticNotifications } from "../../components/Header/DiagnosticNotifications";
import { StatusBadge } from "../../components/StatusBadge";
import {
  createPlayerDetailViewModel,
  type PlayerDetailViewModel
} from "../../view-models/player-detail-view-model";
import { PlayerDevelopmentPlan } from "./PlayerDevelopmentPlan";
import { usePlayerDevelopmentPlan } from "./usePlayerDevelopmentPlan";
import { PlayerMarketValueSection } from "./MarketValuePanel";
import { PlayerPersonalInfoPanel } from "./PlayerPersonalInfoPanel";

export function PlayerDetail({
  clubId,
  development,
  onBack,
  playerId,
  training,
  trainingDiagnostic,
  trainingStatus,
  squadPlanning,
  currency,
  onBackToSquad
}: PlayerDetailProps) {
  const viewModel = createPlayerDetailViewModel({
    playerId,
    training,
    development,
    trainingDiagnostic,
    trainingStatus,
    squadPlanning,
    currency
  });

  if (!viewModel) {
    const isLoading = trainingStatus === "loading";

    return (
      <div className="atlas-player-detail">
        <button
          className="atlas-player-detail__back"
          type="button"
          onClick={isLoading ? onBack : onBackToSquad}
        >
          {isLoading ? "← Back" : "Back to Squad"}
        </button>
        <section className="atlas-player-detail-panel">
          <p className="atlas-player-detail__message">
            {isLoading ? "Loading player..." : "Player not found."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <PlayerDetailContent
      clubId={clubId ?? null}
      player={viewModel}
      training={training}
      onBack={onBack}
    />
  );
}

interface PlayerDetailContentProps {
  clubId: string | null;
  player: PlayerDetailViewModel;
  training: PlayerDetailProps["training"];
  onBack: PlayerDetailProps["onBack"];
}

function PlayerDetailContent({
  clubId,
  player: viewModel,
  training,
  onBack
}: PlayerDetailContentProps) {
  return (
    <div className="atlas-player-detail">
      <PlayerHeader diagnostics={viewModel.diagnostics} player={viewModel.player} onBack={onBack} />
      <PlayerPersonalInfoPanel player={viewModel.player} training={viewModel.training} />
      <div className="atlas-player-detail__summary-grid">
        <SkillsPanel skills={viewModel.skills} />
        <TrainingPanel training={viewModel.training} />
      </div>
      <ProjectionPanel
        projection={viewModel.projection}
        talent={viewModel.talent}
        training={viewModel.training}
      />
      <PlayerMarketValueSection marketValue={viewModel.marketValue ?? null} />
      <DevelopmentPlanBoundary key={viewModel.player.id}>
        <DevelopmentPlanSection clubId={clubId} player={viewModel} training={training} />
      </DevelopmentPlanBoundary>
      <TrainingHistoryPanel rows={viewModel.trainingHistory} />
    </div>
  );
}

interface DevelopmentPlanSectionProps {
  clubId: string | null;
  player: PlayerDetailViewModel;
  training: PlayerDetailProps["training"];
}

function DevelopmentPlanSection({ clubId, player, training }: DevelopmentPlanSectionProps) {
  const developmentPlan = usePlayerDevelopmentPlan({ clubId, player, training });

  return (
    <PlayerDevelopmentPlan
      plan={developmentPlan.plan}
      isLoading={developmentPlan.isLoading}
      isSaving={developmentPlan.isSaving}
      error={developmentPlan.error}
      onUpdateTarget={developmentPlan.updateTarget}
      onResetToAutomatic={developmentPlan.resetToAutomatic}
    />
  );
}

interface DevelopmentPlanBoundaryProps {
  children: ReactNode;
}

interface DevelopmentPlanBoundaryState {
  hasError: boolean;
}

class DevelopmentPlanBoundary extends Component<
  DevelopmentPlanBoundaryProps,
  DevelopmentPlanBoundaryState
> {
  public state: DevelopmentPlanBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): DevelopmentPlanBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(): void {
    // Development Plan failures remain local to this section.
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          className="atlas-player-detail-panel"
          aria-labelledby="player-development-error-title"
        >
          <h2 className="atlas-player-detail-panel__title" id="player-development-error-title">
            Development Plan
          </h2>
          <p className="atlas-player-detail__message">
            Development Plan is temporarily unavailable. Other player details remain available.
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}

interface PlayerHeaderProps {
  diagnostics: PlayerDetailViewModel["diagnostics"];
  player: PlayerDetailViewModel["player"];
  onBack: () => void;
}

function PlayerHeader({ diagnostics, onBack, player }: PlayerHeaderProps) {
  return (
    <header className="atlas-player-detail__header">
      <div className="atlas-player-detail__header-actions">
        <button className="atlas-player-detail__back" type="button" onClick={onBack}>
          ← Back
        </button>
        <DiagnosticNotifications diagnostics={diagnostics} showAll />
      </div>
      <h1>
        {player.countryName ? <CountryNameFlag countryName={player.countryName} /> : null}
        <span>{player.name}</span>
      </h1>
    </header>
  );
}
interface SkillsPanelProps {
  skills: PlayerDetailViewModel["skills"];
}

function SkillsPanel({ skills }: SkillsPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-skills-title">
      <PanelTitle id="player-detail-skills-title" title="Skills" />
      <dl className="atlas-player-detail__skills-grid">
        {skills.map((skill) => (
          <div className={skill.isImportant ? "is-important" : undefined} key={skill.key}>
            <dt>{skill.label}</dt>
            <dd>
              <span
                className={
                  skill.lastWeekChange
                    ? `atlas-player-detail__skill-value is-${skill.lastWeekChange.direction}`
                    : "atlas-player-detail__skill-value"
                }
              >
                <span>{formatNumber(skill.value)}</span>
                {skill.levelLabel ? (
                  <span className="atlas-player-detail__skill-level">({skill.levelLabel})</span>
                ) : null}
              </span>
              {skill.lastWeekChange ? (
                <span
                  aria-label={formatLastWeekSkillChange(skill.lastWeekChange)}
                  className={`atlas-player-detail__skill-change is-${skill.lastWeekChange.direction}`}
                >
                  {formatSkillChangeDelta(skill.lastWeekChange)}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatLastWeekSkillChange(change: {
  direction: "up" | "down";
  levelDelta: number;
}): string {
  const direction = change.direction === "up" ? "gained" : "lost";
  const noun = change.levelDelta === 1 ? "level" : "levels";

  return `Last week: ${direction} ${change.levelDelta} skill ${noun}`;
}

function formatSkillChangeDelta(change: { direction: "up" | "down"; levelDelta: number }): string {
  const sign = change.direction === "up" ? "+" : "−";

  return `${sign}${change.levelDelta}`;
}

interface TrainingPanelProps {
  training: PlayerDetailViewModel["training"];
}

function TrainingPanel({ training }: TrainingPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-training-title">
      <PanelTitle id="player-detail-training-title" title="Training" />
      <dl className="atlas-player-detail__data-list">
        <DataRow label="Position" value={training.position ?? "—"} />
        <DataRow label="Trained Skill" value={training.trainedSkill ?? "—"} />
        <DataRow label="Training type" value={training.trainingType ?? "—"} />
        <DataRow label="Training kind" value={training.trainingKind ?? "—"} />
        <DataRow label="Intensity" value={formatPercentage(training.intensity)} />
        <DataRow label="Progress" value={formatPercentage(training.progress)} />
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={training.status} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface TrainingHistoryPanelProps {
  rows: PlayerDetailViewModel["trainingHistory"];
}

function TrainingHistoryPanel({ rows }: TrainingHistoryPanelProps) {
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-history-title">
      <PanelTitle id="player-detail-history-title" title="Training History" />
      {rows.length === 0 ? (
        <p className="atlas-player-detail__message">No training history available.</p>
      ) : (
        <div className="atlas-player-detail__table-wrap">
          <table className="atlas-player-detail__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Week</th>
                <th scope="col">Type</th>
                <th scope="col">Kind</th>
                <th scope="col">Intensity</th>
                <th scope="col">Skill Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.week}>
                  <td>{formatDateTime(row.date)}</td>
                  <th scope="row">W{row.week}</th>
                  <td>{row.type}</td>
                  <td>{row.kind}</td>
                  <td>{row.intensity}%</td>
                  <td>
                    {row.skillChanges.length === 0
                      ? "—"
                      : row.skillChanges
                          .map((change) => `${change.skill} ${change.before} → ${change.after}`)
                          .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface PanelTitleProps {
  id?: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 className="atlas-player-detail-panel__title atlas-section-title" id={id}>
      {title}
    </h2>
  );
}

interface DataRowProps {
  label: string;
  value: string | number;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
