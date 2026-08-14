import { describeDiagnosticFinding } from "@atlas/web/app/diagnostic-copy";
import { formatTrainingPriority } from "@atlas/web/app/formatters";
import type { DiagnosticFinding } from "@atlas/web/app/types";
import type { SquadAttentionProps, SquadTableProps, SquadV2Props } from "./types";
import {
  createSquadAttentionFindings,
  createSquadPlayerRows,
  SQUAD_SKILL_DEFINITIONS,
  type SquadPlayerRow
} from "../../view-models/squad-view-model";
import {
  TRAINING_POSITIONS,
  type TrainingPositionCode
} from "../../view-models/training-view-model";

const TRAINING_POSITION_TITLES: Record<TrainingPositionCode, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  ATT: "Attacker"
};

export function SquadV2({
  development,
  onSelectPlayer,
  training,
  trainingDiagnostic,
  trainingStatus
}: SquadV2Props) {
  const rows = createSquadPlayerRows({
    development,
    training,
    trainingDiagnostic,
    trainingStatus
  });

  return (
    <div className="v2-squad">
      <header className="v2-squad__header">
        <h1>Squad</h1>
      </header>

      <SquadAttention diagnostic={trainingDiagnostic} status={trainingStatus} />

      <h2 id="squad-players-title" className="v2-squad__section-title">
        Players
      </h2>
      <SquadTable onSelectPlayer={onSelectPlayer} rows={rows} status={trainingStatus} />
    </div>
  );
}

function SquadAttention({ diagnostic, status }: SquadAttentionProps) {
  const findings = createSquadAttentionFindings(diagnostic);

  return (
    <section
      className={`v2-squad-panel v2-squad-panel--attention${findings.length === 0 ? " is-quiet" : ""}`}
      aria-labelledby="squad-attention-title"
    >
      <h2 id="squad-attention-title" className="v2-squad-panel__title">
        Squad Attention
      </h2>
      {status === "loading" ? <SquadMessage>Loading diagnostics...</SquadMessage> : null}
      {status === "error" ? (
        <SquadMessage tone="error">Squad diagnostics are unavailable.</SquadMessage>
      ) : null}
      {status === "idle" ? (
        <SquadMessage>Import a club snapshot to inspect squad diagnostics.</SquadMessage>
      ) : null}
      {status === "ready" && diagnostic === null ? (
        <SquadMessage>
          Squad diagnostics are not available in the current snapshot model.
        </SquadMessage>
      ) : null}
      {status === "ready" && diagnostic !== null && findings.length === 0 ? (
        <SquadMessage tone="quiet">✓ No squad issues requiring attention</SquadMessage>
      ) : null}
      {status === "ready" && findings.length > 0 ? (
        <ul className="v2-squad-attention-list">
          {findings.map((finding) => (
            <SquadAttentionItem
              finding={finding}
              key={`${finding.code}-${finding.affectedPlayerIds.join("-")}`}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface SquadAttentionItemProps {
  finding: DiagnosticFinding;
}

function SquadAttentionItem({ finding }: SquadAttentionItemProps) {
  return (
    <li className={`v2-squad-attention-item is-${finding.severity}`}>
      <span aria-hidden="true">{attentionIcon(finding.severity)}</span>
      <span>{describeDiagnosticFinding(finding)}</span>
    </li>
  );
}

function SquadTable({ onSelectPlayer, rows, status }: SquadTableProps) {
  if (status === "loading") {
    return <SquadMessage>Loading squad...</SquadMessage>;
  }

  if (status === "error") {
    return <SquadMessage tone="error">Unable to load squad.</SquadMessage>;
  }

  if (status === "idle") {
    return <SquadMessage>Import a club snapshot to populate the squad.</SquadMessage>;
  }

  if (rows.length === 0) {
    return <SquadMessage>No players available.</SquadMessage>;
  }

  return (
    <div className="v2-squad-position-sections">
      {TRAINING_POSITIONS.map((position) => {
        const positionRows = rows.filter((row) => row.training.position === position.code);

        return (
          <section
            className="v2-squad-panel v2-squad-panel--players v2-squad-position-section"
            key={position.code}
            aria-labelledby={`squad-position-${position.code}`}
          >
            <div className="v2-squad-position-section__header">
              <h3 id={`squad-position-${position.code}`}>
                {TRAINING_POSITION_TITLES[position.code]}
              </h3>
              <span>{positionRows.length} players</span>
            </div>
            <SquadPositionTable onSelectPlayer={onSelectPlayer} rows={positionRows} />
          </section>
        );
      })}
    </div>
  );
}

interface SquadPositionTableProps {
  onSelectPlayer: (playerId: string) => void;
  rows: SquadPlayerRow[];
}

function SquadPositionTable({ onSelectPlayer, rows }: SquadPositionTableProps) {
  return (
    <div className="v2-squad-table-wrap">
      <table className="v2-squad-table">
        <colgroup>
          <col className="is-player" />
          <col className="is-age" />
          <col className="is-position" />
          {SQUAD_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
          <col className="is-training-position" />
          <col className="is-trained-skill" />
          <col className="is-advanced" />
          <col className="is-efficiency" />
          <col className="is-status" />
        </colgroup>
        <thead>
          <tr className="v2-squad-table__group-row">
            <th colSpan={3} scope="colgroup">
              Player
            </th>
            <th
              className="is-skills-group"
              colSpan={SQUAD_SKILL_DEFINITIONS.length}
              scope="colgroup"
            >
              Skills
            </th>
            <th className="is-training-group" colSpan={5} scope="colgroup">
              Training
            </th>
          </tr>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            <th scope="col">Pos</th>
            {SQUAD_SKILL_DEFINITIONS.map((skill) => (
              <th
                scope="col"
                key={skill.key}
                title={formatTrainingPriority(skill.trainingPriority)}
              >
                {skill.shortLabel}
              </th>
            ))}
            <th scope="col">T.Pos</th>
            <th scope="col">Skill</th>
            <th scope="col">Adv</th>
            <th scope="col">Eff</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <SquadPlayerRowView key={row.playerId} onSelectPlayer={onSelectPlayer} row={row} />
            ))
          ) : (
            <tr>
              <td className="v2-squad-table__empty" colSpan={16}>
                No players assigned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface SquadPlayerRowViewProps {
  onSelectPlayer: (playerId: string) => void;
  row: SquadPlayerRow;
}

function SquadPlayerRowView({ onSelectPlayer, row }: SquadPlayerRowViewProps) {
  return (
    <tr>
      <th scope="row">
        <button
          className="v2-squad-player-link"
          type="button"
          onClick={() => onSelectPlayer(row.playerId)}
        >
          {row.playerName}
        </button>
      </th>
      <td className="v2-squad-table__numeric">{row.age}</td>
      <td className="v2-squad-table__center">{row.position ?? "—"}</td>
      {SQUAD_SKILL_DEFINITIONS.map((skill) => (
        <td className="v2-squad-table__numeric" key={skill.key}>
          {row.skills[skill.key] ?? "—"}
        </td>
      ))}
      <td className="v2-squad-table__center">
        <span className="v2-training-position-badge">{row.training.position ?? "—"}</span>
      </td>
      <td>{row.training.trainedSkill ?? "—"}</td>
      <td className="v2-squad-table__center">
        <span className={`v2-training-advanced${row.training.advanced ? " is-active" : ""}`}>
          {row.training.advanced ? "✓" : "—"}
        </span>
      </td>
      <td className="v2-squad-table__numeric">{formatPercentage(row.training.efficiency)}</td>
      <td>
        <SquadStatus status={row.training.status} />
      </td>
    </tr>
  );
}

interface SquadStatusProps {
  status: SquadPlayerRow["training"]["status"];
}

function SquadStatus({ status }: SquadStatusProps) {
  return (
    <span className={`v2-training-status${status ? ` is-${status.toLowerCase()}` : " is-empty"}`}>
      {status ?? "—"}
    </span>
  );
}

interface SquadMessageProps {
  children: string;
  tone?: "error" | "quiet";
}

function SquadMessage({ children, tone }: SquadMessageProps) {
  return <p className={`v2-squad-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function attentionIcon(severity: DiagnosticFinding["severity"]): string {
  return severity === "info" || severity === "low" ? "ℹ" : "⚠";
}
