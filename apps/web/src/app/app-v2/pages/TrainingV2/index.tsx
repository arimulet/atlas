import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { TrainingPageData, TrainingPagePlayer } from "@atlas/web/app/types";
import type { TrainingV2Props } from "./types";

const trainingPositions = [
  { code: "GK", label: "Goalkeeper" },
  { code: "DEF", label: "Defender" },
  { code: "MID", label: "Midfielder" },
  { code: "ATT", label: "Attacker" }
] as const;
type TrainingPosition = (typeof trainingPositions)[number];
type TrainingPositionCode = TrainingPosition["code"];

export function TrainingV2({ training, trainingStatus }: TrainingV2Props) {
  return (
    <div className="v2-training">
      <header className="v2-training__header">
        <h1>Training</h1>
      </header>

      <TrainingConfiguration configuration={training?.configuration ?? null} />

      <div className="v2-training__main-grid">
        <PlayersTraining
          players={training?.players ?? []}
          status={trainingStatus}
        />
        <TrainingAttention status={trainingStatus} />
      </div>
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
          {trainingPositions.map((position) => (
            <div className="v2-training-configuration__item" key={position.code}>
              <span className="v2-training-position-badge">{position.code}</span>
              <span className="v2-training-position-name">{position.label}</span>
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

interface PlayersTrainingProps {
  players: TrainingPageData["players"];
  status: TrainingV2Props["trainingStatus"];
}

function PlayersTraining({ players, status }: PlayersTrainingProps) {
  return (
    <section className="v2-training-panel v2-training-panel--players" aria-labelledby="players-title">
      <PanelTitle id="players-title" title="Players Training" />
      {status === "loading" ? <PanelMessage>Loading training data...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Training data is unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect training.</PanelMessage>
      ) : null}
      {status === "ready" && players.length === 0 ? (
        <PanelMessage>No players are available in the latest snapshot.</PanelMessage>
      ) : null}
      {status === "ready" && players.length > 0 ? (
        <div className="v2-training-position-tables">
          {trainingPositions.map((position) => (
            <TrainingPositionTable
              key={position.code}
              players={players.filter(
                (player) => trainingPositionCode(player.training.position) === position.code
              )}
              position={position}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface TrainingPositionTableProps {
  players: TrainingPageData["players"];
  position: TrainingPosition;
}

function TrainingPositionTable({ players, position }: TrainingPositionTableProps) {
  return (
    <section
      className="v2-training-position-table"
      aria-labelledby={`training-position-${position.code}`}
    >
      <h3 id={`training-position-${position.code}`}>
        <span className="v2-training-position-heading">
          <span className="v2-training-position-badge">{position.code}</span>
          <span>{position.label}</span>
        </span>
        <span>{players.length} players</span>
      </h3>
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
                  No players assigned
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
          {player.training.advanced ? "✓" : "—"}
        </span>
      </td>
    </tr>
  );
}

interface TrainingAttentionProps {
  status: TrainingV2Props["trainingStatus"];
}

function TrainingAttention({ status }: TrainingAttentionProps) {
  return (
    <section className="v2-training-panel v2-training-panel--attention" aria-labelledby="training-attention-title">
      <PanelTitle id="training-attention-title" title="Training Attention" />
      {status === "loading" ? <PanelMessage>Loading diagnostics...</PanelMessage> : null}
      {status === "error" ? (
        <PanelMessage tone="error">Training diagnostics are unavailable.</PanelMessage>
      ) : null}
      {status === "idle" ? (
        <PanelMessage>Import a club snapshot to inspect training diagnostics.</PanelMessage>
      ) : null}
      {status === "ready" ? (
        <PanelMessage>Training diagnostics are not available in the current snapshot model.</PanelMessage>
      ) : null}
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

function trainingPositionCode(position: number): TrainingPositionCode | null {
  return trainingPositions[position]?.code ?? null;
}

function skillLabel(skill: number | null): string {
  return skill === null ? "Not set" : formatTrainingPriority(skill);
}
