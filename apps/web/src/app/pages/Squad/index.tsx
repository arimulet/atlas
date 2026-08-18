import { formatTrainingPriority } from "../../formatters";
import type { DiagnosticFinding, DiagnosticParameterValue } from "@atlas/web/app/types";
import {
  formatEta,
  formatNumber,
  formatPercentage,
  formatTalent
} from "../../formatters";
import { AttentionIcon } from "../../components/AttentionIcon";
import { PlayerLink } from "../../components/PlayerLink";
import { StatusBadge } from "../../components/StatusBadge";
import type { SquadAttentionProps, SquadTableProps, SquadProps } from "./types";
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

export function Squad({
  development,
  onSelectPlayer,
  projectionSummaries,
  training,
  trainingDiagnostic,
  trainingStatus
}: SquadProps) {
  const rows = createSquadPlayerRows({
    development,
    projectionSummaries,
    training,
    trainingDiagnostic,
    trainingStatus
  });

  return (
    <div className="atlas-squad">
      <header className="atlas-squad__header">
        <h1>Squad</h1>
      </header>

      <SquadAttention diagnostic={trainingDiagnostic} status={trainingStatus} />

      <h2 id="squad-players-title" className="atlas-squad__section-title">
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
      className={`atlas-squad-panel atlas-squad-panel--attention${findings.length === 0 ? " is-quiet" : ""}`}
      aria-labelledby="squad-attention-title"
    >
      <h2 id="squad-attention-title" className="atlas-squad-panel__title atlas-section-title">
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
        <ul className="atlas-squad-attention-list">
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
    <li className={`atlas-squad-attention-item is-${finding.severity}`}>
      <AttentionIcon severity={finding.severity} />
      <span>{describeSquadFinding(finding)}</span>
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
    <div className="atlas-squad-position-sections">
      {TRAINING_POSITIONS.map((position) => {
        const positionRows = rows.filter((row) => row.training.position === position.code);

        return (
          <section
            className="atlas-squad-panel atlas-squad-panel--players atlas-squad-position-section"
            key={position.code}
            aria-labelledby={`squad-position-${position.code}`}
          >
            <div className="atlas-squad-position-section__header">
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
    <div className="atlas-squad-table-wrap">
      <table className="atlas-squad-table">
        <colgroup>
          <col className="is-player" />
          <col className="is-age" />
          <col className="is-form" />
          {SQUAD_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
          <col className="is-trained-skill" />
          <col className="is-advanced" />
          <col className="is-efficiency" />
          <col className="is-progress" />
          <col className="is-talent" />
          <col className="is-next-skill-up" />
          <col className="is-eta" />
          <col className="is-status" />
        </colgroup>
        <thead>
          <tr className="atlas-squad-table__group-row">
            <th colSpan={2} scope="colgroup">
              Player
            </th>
            <th
              className="is-skills-group"
              colSpan={SQUAD_SKILL_DEFINITIONS.length + 1}
              scope="colgroup"
            >
              Skills
            </th>
            <th className="is-training-group" colSpan={8} scope="colgroup">
              Training / Development
            </th>
          </tr>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            <th scope="col" title="Form">
              Form
            </th>
            {SQUAD_SKILL_DEFINITIONS.map((skill) => (
              <th
                scope="col"
                key={skill.key}
                title={formatTrainingPriority(skill.trainingPriority)}
              >
                {skill.shortLabel}
              </th>
            ))}
            <th scope="col" title="Trained Skill">
              Skill
            </th>
            <th scope="col" title="Advanced">
              Adv
            </th>
            <th scope="col" title="Efficiency">
              Eff
            </th>
            <th scope="col" title="Progress">
              Prog
            </th>
            <th scope="col">Talent</th>
            <th scope="col" title="Next Skill-up">
              Next
            </th>
            <th scope="col">ETA</th>
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
              <td className="atlas-squad-table__empty" colSpan={19}>
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
        <PlayerLink playerId={row.playerId} onSelectPlayer={onSelectPlayer}>
          {row.playerName}
        </PlayerLink>
      </th>
      <td className="atlas-squad-table__numeric">{row.age}</td>
      <td className="atlas-squad-table__numeric">{row.form ?? "—"}</td>
      {SQUAD_SKILL_DEFINITIONS.map((skill) => (
        <td className="atlas-squad-table__numeric" key={skill.key}>
          {row.skills[skill.key] ?? "—"}
        </td>
      ))}
      <td>{row.training.trainedSkill ?? "—"}</td>
      <td className="atlas-squad-table__center">
        {row.training.trainingKind ?? "—"}
      </td>
      <td className="atlas-squad-table__numeric">{formatPercentage(row.training.intensity)}</td>
      <td className="atlas-squad-table__numeric">{formatPercentage(row.training.progress)}</td>
      <td className="atlas-squad-table__numeric">{formatTalent(row.development.talent)}</td>
      <td className="atlas-squad-table__numeric">{formatNumber(row.development.nextSkillUp)}</td>
      <td className="atlas-squad-table__numeric">{formatEta(row.development.etaWeeks)}</td>
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
  return <StatusBadge status={status} />;
}

interface SquadMessageProps {
  children: string;
  tone?: "error" | "quiet";
}

function SquadMessage({ children, tone }: SquadMessageProps) {
  return <p className={`atlas-squad-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

const roleLabels: Record<string, string> = {
  goalkeeper: "arquero",
  defender: "defensor",
  midfielder: "mediocampista",
  winger: "extremo",
  striker: "delantero"
};

function describeSquadFinding(finding: DiagnosticFinding): string {
  const parameters = finding.parameters ?? {};

  if (finding.code.startsWith("squad-balance.") && finding.code.endsWith(".deficit")) {
    return (
      "La plantilla tiene " +
      formatDiagnosticNumber(parameters.currentCount) +
      " jugador(es) en " +
      diagnosticRoleLabel(parameters.role) +
      "; el mínimo de referencia es " +
      formatDiagnosticNumber(parameters.minimum) +
      "."
    );
  }

  switch (finding.code) {
    case "economic-risk.high-wage-low-value-ratio":
      return (
        diagnosticStringValue(parameters.playerName) +
        " tiene un salario alto (" +
        formatDiagnosticNumber(parameters.wage) +
        ") en relación con su valor estimado (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "asset-risk.senior-high-value":
      return (
        diagnosticStringValue(parameters.playerName) +
        " combina una edad senior con un valor estimado relevante (" +
        formatDiagnosticNumber(parameters.value) +
        ")."
      );
    case "training-potential.young-role-fit":
      return diagnosticStringValue(parameters.playerName) + " es joven y muestra un buen ajuste para su rol.";
    case "follow-up.incomplete-player-data":
      return (
        diagnosticStringValue(parameters.playerName) +
        " requiere seguimiento porque sus datos importados están incompletos."
      );
    default:
      return finding.code;
  }
}

function diagnosticRoleLabel(value: DiagnosticParameterValue | undefined): string {
  return roleLabels[diagnosticStringValue(value)] ?? diagnosticStringValue(value);
}

function diagnosticStringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "dato no disponible" : String(value);
}

function formatDiagnosticNumber(value: DiagnosticParameterValue | undefined): string {
  return typeof value === "number"
    ? value.toLocaleString("es-AR")
    : diagnosticStringValue(value);
}
