"use client";

import { useState } from "react";
import type { TrainingPageData } from "@atlas/web/app/types";
import { formatTrainingPriority } from "../../formatters";
import type { TrainingProps } from "./types";
import { TRAINING_POSITIONS } from "../../view-models/training-view-model";
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
