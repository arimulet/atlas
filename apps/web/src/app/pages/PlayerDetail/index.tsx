import { Component, type ReactNode } from "react";
import type { PlayerDetailProps } from "./types";
import { ProjectionPanel } from "./ProjectionPanel";
import { formatNumber, formatPercentage } from "../../formatters";
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
  const skills = rows[0]?.skills ?? [];
  return (
    <section className="atlas-player-detail-panel" aria-labelledby="player-detail-history-title">
      <PanelTitle id="player-detail-history-title" title="Training History" />
      {rows.length === 0 ? (
        <p className="atlas-player-detail__message">No training history available.</p>
      ) : (
        <div className="atlas-player-detail__table-wrap">
          <table className="atlas-player-detail__table atlas-player-detail__history-table">
            <thead>
              <tr>
                <th scope="col">Season / Week</th>
                <th scope="col">Training</th>
                {skills.map((skill) => (
                  <th key={skill.key} scope="col" title={skill.label}>
                    {skill.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  className={
                    index > 0 && row.season !== rows[index - 1]?.season
                      ? "is-season-start"
                      : undefined
                  }
                  key={row.id}
                >
                  <th className="atlas-player-detail__history-period" scope="row">
                    S{row.season ?? "—"} · W{row.seasonWeek}
                  </th>
                  <td className="atlas-player-detail__history-training">
                    <TrainingHistoryKind kind={row.kind} />
                    {row.intensity > 0 ? <strong>{row.intensity}%</strong> : null}
                  </td>
                  {row.skills.map((skill) => (
                    <td
                      className={`atlas-player-detail__history-skill${skill.isTrained ? " is-trained" : ""}${skill.change ? ` is-${skill.change.direction}` : ""}`}
                      key={skill.key}
                      title={trainingHistorySkillTitle(skill)}
                    >
                      <span>{formatNumber(skill.value)}</span>
                      {skill.change ? (
                        <span
                          aria-hidden="true"
                          className="atlas-player-detail__history-skill-change"
                        >
                          {skill.change.direction === "up" ? "↑" : "↓"}
                          {skill.change.levelDelta}
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TrainingHistoryKind({
  kind
}: {
  kind: PlayerDetailViewModel["trainingHistory"][number]["kind"];
}) {
  const presentation =
    kind === "advanced"
      ? { icon: "⚡", label: "Advanced training" }
      : kind === "formation"
        ? { icon: "◌", label: "Formation training" }
        : { icon: "⊘", label: "No training recorded" };

  return (
    <span
      aria-label={presentation.label}
      className={`atlas-player-detail__history-kind is-${kind}`}
      title={presentation.label}
    >
      {presentation.icon}
    </span>
  );
}

function trainingHistorySkillTitle(
  skill: PlayerDetailViewModel["trainingHistory"][number]["skills"][number]
): string {
  const level =
    skill.value === null
      ? "—"
      : `${skill.value}${skill.levelLabel ? ` (${skill.levelLabel})` : ""}`;
  const change =
    skill.change === null
      ? ""
      : ` · ${skill.change.direction === "up" ? "+" : "−"}${skill.change.levelDelta}`;

  return `${skill.label}: ${level}${change}`;
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
