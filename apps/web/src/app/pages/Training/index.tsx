import { useState } from "react";
import type {
  DiagnosticFinding,
  DiagnosticParameterValue,
  TrainingPageData
} from "@atlas/web/app/types";
import { formatTrainingPriority } from "../../formatters";
import type { TrainingProps } from "./types";
import { AttentionIcon } from "../../components/AttentionIcon";
import {
  compareDiagnosticSeverity,
  TRAINING_POSITIONS
} from "../../view-models/training-view-model";
import { recommendationLabel } from "./training-intelligence-view-model";
import { useWeeklyTrainingIntelligence } from "./useWeeklyTrainingIntelligence";
import { RecentTrainingProgressModal } from "./RecentTrainingProgressModal";
import { TrainingPlayerTables } from "./TrainingPlayerTables";

export function Training({
  clubId,
  onSelectPlayer,
  projectionSummaries,
  training,
  trainingDiagnostic,
  trainingStatus
}: TrainingProps) {
  const [isRecentProgressOpen, setIsRecentProgressOpen] = useState(false);
  const weeklyTrainingIntelligence = useWeeklyTrainingIntelligence(clubId);
  const recommendations = new Map(
    (weeklyTrainingIntelligence.data?.recommendations ?? []).map((recommendation) => [
      String(recommendation.playerId),
      recommendationLabel(recommendation)
    ])
  );

  return (
    <div className="atlas-training">
      <header className="atlas-training__header">
        <h1>Training</h1>
        <button
          className="atlas-training__recent-progress-button"
          onClick={() => setIsRecentProgressOpen(true)}
          type="button"
        >
          View Recent Progress
        </button>
      </header>

      <TrainingConfiguration configuration={training?.configuration ?? null} />
      {trainingStatus === "ready" ? (
        <TrainingPlayerTables
          configuration={training?.configuration ?? null}
          diagnostic={trainingDiagnostic}
          history={training?.history ?? []}
          onSelectPlayer={onSelectPlayer}
          players={training?.players ?? []}
          projectionSummaries={projectionSummaries}
          recommendations={recommendations}
        />
      ) : null}
      <TrainingAttention diagnostic={trainingDiagnostic} status={trainingStatus} />
      <RecentTrainingProgressModal
        history={training?.history ?? []}
        isOpen={isRecentProgressOpen}
        onClose={() => setIsRecentProgressOpen(false)}
        players={training?.players ?? []}
      />
    </div>
  );
}
interface TrainingConfigurationProps {
  configuration: TrainingPageData["configuration"];
}

function TrainingConfiguration({ configuration }: TrainingConfigurationProps) {
  return (
    <section className="atlas-training-panel" aria-labelledby="training-configuration-title">
      <PanelTitle id="training-configuration-title" title="Training Configuration" />
      {configuration ? (
        <div className="atlas-training-configuration">
          {TRAINING_POSITIONS.map((position) => (
            <div className="atlas-training-configuration__item" key={position.code}>
              <span className="atlas-training-position-badge">{position.code}</span>
              <strong>{skillLabel(configuration[position.code])}</strong>
            </div>
          ))}
        </div>
      ) : (
        <PanelMessage>Training configuration is not available.</PanelMessage>
      )}
    </section>
  );
}

interface TrainingAttentionProps {
  diagnostic: TrainingProps["trainingDiagnostic"];
  status: TrainingProps["trainingStatus"];
}

function TrainingAttention({ diagnostic, status }: TrainingAttentionProps) {
  const trainingFindings =
    diagnostic?.findings
      .filter((finding) => finding.category === "training-potential")
      .sort(compareDiagnosticSeverity)
      .slice(0, 5) ?? [];

  return (
    <section
      className="atlas-training-panel atlas-training-panel--attention"
      aria-labelledby="training-attention-title"
    >
      <PanelTitle id="training-attention-title" title="Training Attention" />
      {status === "loading" ? <PanelMessage>Loading diagnostics...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Training diagnostics are unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect training diagnostics.</PanelMessage>
      ) : null}
      {status === "ready" && diagnostic === null ? (
        <PanelMessage>
          Training diagnostics are not available in the current snapshot model.
        </PanelMessage>
      ) : null}
      {status === "ready" && diagnostic !== null && trainingFindings.length === 0 ? (
        <PanelMessage>No training issues detected.</PanelMessage>
      ) : null}
      {status === "ready" && trainingFindings.length > 0 ? (
        <ul className="atlas-training-attention-list">
          {trainingFindings.map((finding) => (
            <TrainingAttentionItem
              key={`${finding.code}-${finding.affectedPlayerIds.join("-")}`}
              finding={finding}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface TrainingAttentionItemProps {
  finding: DiagnosticFinding;
}

function TrainingAttentionItem({ finding }: TrainingAttentionItemProps) {
  return (
    <li className={`atlas-training-attention-item is-${finding.severity}`}>
      <AttentionIcon severity={finding.severity} />
      <span>{describeTrainingFinding(finding)}</span>
    </li>
  );
}

interface PanelTitleProps {
  id: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 id={id} className="atlas-training-panel__title atlas-section-title">
      {title}
    </h2>
  );
}

interface PanelMessageProps {
  children: string;
  tone?: "error";
}

function PanelMessage({ children, tone }: PanelMessageProps) {
  return <p className={`atlas-training-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

function skillLabel(skill: number | null): string {
  return skill === null ? "\u2014" : formatTrainingSkill(skill);
}

function formatTrainingSkill(skill: number): string {
  return formatTrainingPriority(skill);
}

function describeTrainingFinding(finding: DiagnosticFinding): string {
  if (finding.code === "training-potential.young-role-fit") {
    return (
      trainingDiagnosticStringValue(finding.parameters?.playerName) +
      " es joven y muestra un buen ajuste para su rol."
    );
  }

  return finding.code;
}

function trainingDiagnosticStringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "dato no disponible" : String(value);
}
