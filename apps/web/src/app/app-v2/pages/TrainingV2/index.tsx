import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { DiagnosticFinding, TrainingPageData, TrainingPagePlayer } from "@atlas/web/app/types";
import type { TrainingV2Props } from "./types";

const TRAINING_POSITIONS = [
  { code: "GK", trainingPosition: 0 },
  { code: "DEF", trainingPosition: 1 },
  { code: "MID", trainingPosition: 2 },
  { code: "ATT", trainingPosition: 3 }
] as const;

type TrainingPosition = (typeof TRAINING_POSITIONS)[number];

export function TrainingV2({ training, trainingDiagnostic, trainingStatus }: TrainingV2Props) {
  return (
    <div className="v2-training">
      <header className="v2-training__header">
        <h1>Training</h1>
      </header>

      <TrainingConfiguration configuration={training?.configuration ?? null} />
      <TrainingAttention diagnostic={trainingDiagnostic} status={trainingStatus} />
      <TrainingPositionSections
        configuration={training?.configuration ?? null}
        players={training?.players ?? []}
        status={trainingStatus}
      />
      <RecentTrainingProgress />
    </div>
  );
}

interface TrainingConfigurationProps {
  configuration: TrainingPageData["configuration"];
}

function TrainingConfiguration({ configuration }: TrainingConfigurationProps) {
  return (
    <section className="v2-training-panel" aria-labelledby="training-configuration-title">
      <PanelTitle id="training-configuration-title" title="Training Configuration" />
      {configuration ? (
        <div className="v2-training-configuration">
          {TRAINING_POSITIONS.map((position) => (
            <div className="v2-training-configuration__item" key={position.code}>
              <span className="v2-training-position-badge">{position.code}</span>
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
  diagnostic: TrainingV2Props["trainingDiagnostic"];
  status: TrainingV2Props["trainingStatus"];
}

function TrainingAttention({ diagnostic, status }: TrainingAttentionProps) {
  const trainingFindings =
    diagnostic?.findings
      .filter((finding) => finding.category === "training-potential")
      .sort(compareDiagnosticSeverity)
      .slice(0, 5) ?? [];

  return (
    <section
      className="v2-training-panel v2-training-panel--attention"
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
        <ul className="v2-training-attention-list">
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
    <li className={`v2-training-attention-item is-${finding.severity}`}>
      <span aria-hidden="true">{attentionIcon(finding.severity)}</span>
      <span>{describeDiagnosticFinding(finding)}</span>
    </li>
  );
}

interface TrainingPositionSectionsProps {
  configuration: TrainingPageData["configuration"];
  players: TrainingPageData["players"];
  status: TrainingV2Props["trainingStatus"];
}

function TrainingPositionSections({
  configuration,
  players,
  status
}: TrainingPositionSectionsProps) {
  if (status !== "ready") {
    return null;
  }

  return (
    <div className="v2-training-position-sections">
      {TRAINING_POSITIONS.map((position) => (
        <TrainingPositionSection
          key={position.code}
          players={players.filter(
            (player) => player.training.position === position.trainingPosition
          )}
          position={position}
          trainedSkill={configuration?.[position.code] ?? null}
        />
      ))}
    </div>
  );
}

interface TrainingPositionSectionProps {
  players: TrainingPageData["players"];
  position: TrainingPosition;
  trainedSkill: number | null;
}

function TrainingPositionSection({
  players,
  position,
  trainedSkill
}: TrainingPositionSectionProps) {
  return (
    <section
      className="v2-training-position-section"
      aria-labelledby={`training-position-${position.code}`}
    >
      <div className="v2-training-position-section__header">
        <h2 id={`training-position-${position.code}`}>
          {position.code} · {skillLabel(trainedSkill)}
        </h2>
        <span>{players.length} players</span>
      </div>
      <TrainingPositionTable players={players} />
    </section>
  );
}

interface TrainingPositionTableProps {
  players: TrainingPageData["players"];
}

function TrainingPositionTable({ players }: TrainingPositionTableProps) {
  return (
    <div className="v2-training-table-wrap">
      <table className="v2-training-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            <th scope="col">Advanced</th>
          </tr>
        </thead>
        <tbody>
          {players.length > 0 ? (
            players.map((player) => <PlayerRow key={player.id} player={player} />)
          ) : (
            <tr>
              <td className="v2-training-table__empty" colSpan={3}>
                No players assigned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PlayerRowProps {
  player: TrainingPagePlayer;
}

function PlayerRow({ player }: PlayerRowProps) {
  return (
    <tr>
      <th scope="row">{player.name}</th>
      <td>{player.age}</td>
      <td>
        <span className={`v2-training-advanced${player.training.advanced ? " is-active" : ""}`}>
          {player.training.advanced ? "\u2713" : "\u2014"}
        </span>
      </td>
    </tr>
  );
}

function RecentTrainingProgress() {
  return (
    <section className="v2-training-panel" aria-labelledby="recent-progress-title">
      <PanelTitle id="recent-progress-title" title="Recent Progress" />
      <PanelMessage>No recent skill-ups detected.</PanelMessage>
    </section>
  );
}

interface PanelTitleProps {
  id: string;
  title: string;
}

function PanelTitle({ id, title }: PanelTitleProps) {
  return (
    <h2 id={id} className="v2-training-panel__title">
      {title}
    </h2>
  );
}

interface PanelMessageProps {
  children: string;
  tone?: "error";
}

function PanelMessage({ children, tone }: PanelMessageProps) {
  return <p className={`v2-training-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

function skillLabel(skill: number | null): string {
  return skill === null ? "Not set" : formatTrainingPriority(skill);
}

function attentionIcon(severity: DiagnosticFinding["severity"]): string {
  return severity === "info" || severity === "low" ? "ℹ" : "⚠";
}

function compareDiagnosticSeverity(first: DiagnosticFinding, second: DiagnosticFinding): number {
  const severityOrder: Record<DiagnosticFinding["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3
  };

  return severityOrder[first.severity] - severityOrder[second.severity];
}
