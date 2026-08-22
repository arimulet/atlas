import { useMemo, useState, type ReactNode } from "react";
import type { DiagnosticFinding, DiagnosticParameterValue } from "@atlas/web/app/types";
import type { SquadRole } from "@atlas/domain";
import { AttentionIcon } from "../../components/AttentionIcon";
import { CountryNameFlag } from "../../components/CountryNameFlag";
import { PlayerLink } from "../../components/PlayerLink";
import type { SquadAttentionProps, SquadTableProps, SquadProps } from "./types";
import {
  SquadPlanningSections,
  describeManualRoleConflict,
  planningConfidenceWarning,
  roleOptionLabel,
  roleOptions
} from "./SquadPlanningSections";
import { useSquadPlanning } from "./useSquadPlanning";
import {
  formatContributionScore,
  lifecycleLabel,
  profileLabel,
  roleLabel,
  type SquadPlanningFilters
} from "./squad-planning-view-model";
import {
  createSquadAttentionFindings,
  createSquadPlayerRows,
  isSquadSkillRequiredForPosition,
  SQUAD_SKILL_DEFINITIONS,
  type SquadPlayerRow
} from "../../view-models/squad-view-model";
import { createSquadMarketValueSummary } from "../../view-models/market-value-view-model";
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
  onSaveSquadRole,
  projectionSummaries,
  squadPlanning,
  squadPlanningStatus,
  training,
  trainingDiagnostic,
  trainingStatus,
  currency
}: SquadProps) {
  const rows = createSquadPlayerRows({
    development,
    projectionSummaries,
    training,
    trainingDiagnostic,
    trainingStatus,
    squadPlanning,
    currency
  });
  const { filteredRows, filters, setProfileFilter, setRoleFilter, viewModel } = useSquadPlanning({
    planning: squadPlanning,
    rows
  });
  const [marketSort, setMarketSort] = useState<MarketSort>("value");
  const sortedRows = useMemo(
    () => sortSquadRowsByMarketValue(filteredRows, marketSort),
    [filteredRows, marketSort]
  );
  const marketSummary = createSquadMarketValueSummary(
    squadPlanning?.assessment.depthPlayers ?? [],
    currency
  );

  return (
    <div className="atlas-squad">
      <header className="atlas-squad__header">
        <h1>Squad</h1>
      </header>

      <SquadMarketSummary summary={marketSummary} />

      {squadPlanningStatus === "loading" ? (
        <SquadMessage>Loading squad planning...</SquadMessage>
      ) : null}
      {squadPlanningStatus === "error" ? (
        <SquadMessage tone="error">
          Squad Planning is unavailable. Basic squad data remains available.
        </SquadMessage>
      ) : null}
      {squadPlanningStatus === "idle" ? (
        <SquadMessage>Squad planning data is not available yet.</SquadMessage>
      ) : null}
      {squadPlanningStatus === "ready" && viewModel ? (
        <>
          <SquadPlanningSections onSelectPlayer={onSelectPlayer} viewModel={viewModel} />
          {planningConfidenceWarning(viewModel) ? (
            <SquadMessage tone="quiet">{planningConfidenceWarning(viewModel)}</SquadMessage>
          ) : null}
        </>
      ) : null}

      <SquadAttention diagnostic={trainingDiagnostic} status={trainingStatus} />

      <h2 id="squad-players-title" className="atlas-squad__section-title">
        Players
      </h2>
      <SquadPlanningFiltersBar
        filters={filters}
        marketSort={marketSort}
        onProfileChange={setProfileFilter}
        onRoleChange={setRoleFilter}
        onMarketSortChange={setMarketSort}
        planningAvailable={squadPlanningStatus === "ready" && squadPlanning !== null}
      />
      <SquadTable
        onSaveSquadRole={onSaveSquadRole}
        onSelectPlayer={onSelectPlayer}
        planning={squadPlanning}
        rows={sortedRows}
        status={trainingStatus}
      />
    </div>
  );
}

function SquadMarketSummary({
  summary
}: {
  summary: ReturnType<typeof createSquadMarketValueSummary>;
}) {
  return (
    <section
      className="atlas-squad-panel atlas-squad-market-summary"
      aria-labelledby="squad-market-title"
    >
      <div className="atlas-squad-market-summary__heading">
        <div>
          <p className="atlas-squad-market-summary__eyebrow">Market Value</p>
          <h2 id="squad-market-title" className="atlas-squad-panel__title atlas-section-title">
            Squad asset overview
          </h2>
        </div>
        <span>
          {summary.coverage.valued}/{summary.coverage.total} players valued
        </span>
      </div>
      <div className="atlas-squad-market-summary__metrics">
        <SummaryMetric label="Current squad value" value={summary.currentTotal.label} />
        <SummaryMetric label="Projected at targets" value={summary.projectedTotal.label} />
        <SummaryMetric
          label="Potential value creation"
          value={summary.potentialValueCreation.label}
        />
        <SummaryMetric
          label="Comparable-backed"
          value={`${summary.coverage.comparableBacked} players`}
        />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-squad-market-summary__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface SquadPlanningFiltersBarProps {
  filters: SquadPlanningFilters;
  marketSort: MarketSort;
  onProfileChange: (profile: SquadPlanningFilters["profile"]) => void;
  onRoleChange: (role: SquadPlanningFilters["role"]) => void;
  onMarketSortChange: (sort: MarketSort) => void;
  planningAvailable: boolean;
}

function SquadPlanningFiltersBar({
  filters,
  marketSort,
  onProfileChange,
  onRoleChange,
  onMarketSortChange,
  planningAvailable
}: SquadPlanningFiltersBarProps) {
  return (
    <div className="atlas-squad-filters" aria-label="Squad filters">
      <label>
        Role
        <select
          disabled={!planningAvailable}
          value={filters.role}
          onChange={(event) => onRoleChange(event.target.value as SquadPlanningFilters["role"])}
        >
          <option value="all">All</option>
          <option value="attention">Attention</option>
          {roleOptions().map((role) => (
            <option key={role} value={role}>
              {roleOptionLabel(role)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Market sort
        <select
          disabled={!planningAvailable}
          value={marketSort}
          onChange={(event) => onMarketSortChange(event.target.value as MarketSort)}
        >
          <option value="default">Default</option>
          <option value="value">Game value</option>
          <option value="current">Estimated value</option>
          <option value="efficiency">Training value / week</option>
        </select>
      </label>
      <label>
        Development Profile
        <select
          disabled={!planningAvailable}
          value={filters.profile}
          onChange={(event) =>
            onProfileChange(event.target.value as SquadPlanningFilters["profile"])
          }
        >
          <option value="all">All profiles</option>
          {(["goalkeeper", "defender", "midfielder", "forward"] as const).map((profile) => (
            <option key={profile} value={profile}>
              {profileLabel(profile)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type MarketSort = "default" | "value" | "current" | "efficiency";

function sortSquadRowsByMarketValue(rows: SquadPlayerRow[], sort: MarketSort): SquadPlayerRow[] {
  if (sort === "default") return rows;
  return [...rows].sort((left, right) => {
    const leftValue = marketSortValue(left, sort);
    const rightValue = marketSortValue(right, sort);
    return (
      (rightValue ?? -1) - (leftValue ?? -1) || left.playerName.localeCompare(right.playerName)
    );
  });
}

function marketSortValue(row: SquadPlayerRow, sort: Exclude<MarketSort, "default">): number | null {
  if (sort === "value") return row.gameValue?.value ?? null;
  if (!row.marketValue) return null;
  if (sort === "current") return row.marketValue.current.expected.value;
  return row.marketValue.training?.averageValueGainPerWeek?.value ?? null;
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

function SquadTable({ onSaveSquadRole, onSelectPlayer, planning, rows, status }: SquadTableProps) {
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
            <SquadPositionTable
              onSaveSquadRole={onSaveSquadRole}
              onSelectPlayer={onSelectPlayer}
              planning={planning}
              position={position.code}
              rows={positionRows}
            />
          </section>
        );
      })}
    </div>
  );
}

interface SquadPositionTableProps {
  onSaveSquadRole: SquadTableProps["onSaveSquadRole"];
  onSelectPlayer: (playerId: string) => void;
  planning: SquadTableProps["planning"];
  position: TrainingPositionCode;
  rows: SquadPlayerRow[];
}

function SquadPositionTable({
  onSaveSquadRole,
  onSelectPlayer,
  planning,
  position,
  rows
}: SquadPositionTableProps) {
  const playersById = new Map(
    (planning?.assessment.depthPlayers ?? []).map((player) => [String(player.playerId), player])
  );
  return (
    <div className="atlas-squad-table-wrap">
      <table className="atlas-squad-table">
        <colgroup>
          <col className="is-player" />
          <col className="is-age" />
          <col className="is-game-value" />
          <col className="is-form" />
          {SQUAD_SKILL_DEFINITIONS.map((skill) => (
            <col className="is-skill" key={skill.key} />
          ))}
          <col className="is-market-value" />
          <col className="is-planning" />
        </colgroup>
        <thead>
          <tr className="atlas-squad-table__group-row">
            <th colSpan={3} scope="colgroup">
              Player
            </th>
            <th
              className="is-skills-group"
              colSpan={SQUAD_SKILL_DEFINITIONS.length + 1}
              scope="colgroup"
            >
              Skills
            </th>
            <th className="is-market-group" scope="colgroup">
              Market Value
            </th>
            <th className="is-planning-group" scope="colgroup">
              Planning
            </th>
          </tr>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Age</th>
            <th scope="col">Value</th>
            <th scope="col" title="Form">
              Form
            </th>
            {SQUAD_SKILL_DEFINITIONS.map((skill) => (
              <th
                className={
                  isSquadSkillRequiredForPosition(position, skill.key)
                    ? "is-position-skill"
                    : undefined
                }
                key={skill.key}
                scope="col"
                title={
                  isSquadSkillRequiredForPosition(position, skill.key)
                    ? `Required for ${TRAINING_POSITION_TITLES[position]}`
                    : undefined
                }
              >
                {skill.shortLabel}
              </th>
            ))}
            <th scope="col">Current</th>
            <th scope="col">Planning</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <SquadPlayerRowView
                key={row.playerId}
                onSaveSquadRole={onSaveSquadRole}
                onSelectPlayer={onSelectPlayer}
                planningPlayer={playersById.get(row.playerId) ?? null}
                position={position}
                row={row}
              />
            ))
          ) : (
            <tr>
              <td className="atlas-squad-table__empty" colSpan={14}>
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
  onSaveSquadRole: SquadTableProps["onSaveSquadRole"];
  onSelectPlayer: (playerId: string) => void;
  planningPlayer:
    NonNullable<SquadTableProps["planning"]>["assessment"]["depthPlayers"][number] | null;
  position: TrainingPositionCode;
  row: SquadPlayerRow;
}

function SquadPlayerRowView({
  onSaveSquadRole,
  onSelectPlayer,
  planningPlayer,
  position,
  row
}: SquadPlayerRowViewProps) {
  return (
    <tr>
      <th scope="row">
        <span className="atlas-squad-player-name">
          {row.countryName ? <CountryNameFlag countryName={row.countryName} /> : null}
          <PlayerLink playerId={row.playerId} onSelectPlayer={onSelectPlayer}>
            {row.playerName}
          </PlayerLink>
          <SquadStatusIcon status={row.training.status} />
        </span>
      </th>
      <td className="atlas-squad-table__numeric">{row.age}</td>
      <td className="atlas-squad-table__numeric">{row.gameValue?.label ?? "—"}</td>
      <td className="atlas-squad-table__numeric">{row.form ?? "—"}</td>
      {SQUAD_SKILL_DEFINITIONS.map((skill) => (
        <td
          className={`atlas-squad-table__numeric${isSquadSkillRequiredForPosition(position, skill.key) ? " is-position-skill" : ""}`}
          key={skill.key}
        >
          {row.skills[skill.key] ?? "—"}
        </td>
      ))}
      <td className="atlas-squad-table__numeric">
        {row.marketValue?.current.expected.label ?? "—"}
      </td>
      <td>
        <SquadPlanningRoleControl
          onSaveSquadRole={onSaveSquadRole}
          playerId={row.playerId}
          playerName={row.playerName}
          planningPlayer={planningPlayer}
        />
      </td>
    </tr>
  );
}

interface SquadPlanningRoleControlProps {
  onSaveSquadRole: SquadTableProps["onSaveSquadRole"];
  playerId: string;
  playerName: string;
  planningPlayer: SquadPlayerRowViewProps["planningPlayer"];
}

function SquadPlanningRoleControl({
  onSaveSquadRole,
  playerId,
  playerName,
  planningPlayer
}: SquadPlanningRoleControlProps) {
  const manualRole = planningPlayer?.manualRole?.role ?? null;
  const automaticRole = planningPlayer?.automaticRole ?? null;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SquadRole | "automatic">(
    manualRole ?? "automatic"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (planningPlayer === null) {
    return "—";
  }

  const handleEdit = () => {
    setSelectedRole(manualRole ?? "automatic");
    setSaveMessage(null);
    setIsEditorOpen(true);
  };

  const handleCancel = () => {
    setSelectedRole(manualRole ?? "automatic");
    setIsEditorOpen(false);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await onSaveSquadRole(playerId, selectedRole === "automatic" ? null : selectedRole);
      setIsEditorOpen(false);
      setSaveMessage("Saved");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Unable to save squad role.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="atlas-squad-planning-cell">
      <div className="atlas-squad-planning-cell__overview">
        <div
          className="atlas-squad-planning-cell__summary"
          title={`Current contribution: ${formatContributionScore(planningPlayer.currentContributionScore)} · Future contribution: ${formatContributionScore(planningPlayer.futureContributionScore)}`}
        >
          <span className={`atlas-squad-planning-badge is-${planningPlayer.role}`}>
            {roleLabel(planningPlayer.role)}
          </span>
          <span className="atlas-squad-planning-cell__lifecycle">
            {lifecycleLabel(planningPlayer.lifecycle)}
          </span>
        </div>
        {!isEditorOpen ? (
          <button
            aria-label={`Edit squad role for ${playerName}`}
            className="atlas-squad-planning-cell__action"
            onClick={handleEdit}
            title="Edit squad role"
            type="button"
          >
            <RoleActionIcon type="edit" />
          </button>
        ) : null}
      </div>
      {automaticRole && manualRole && automaticRole !== manualRole ? (
        <small>{describeManualRoleConflict(automaticRole, manualRole)}</small>
      ) : null}
      {saveMessage ? (
        <small className={saveMessage === "Saved" ? "is-success" : "is-error"}>{saveMessage}</small>
      ) : null}
      {isEditorOpen ? (
        <div className="atlas-squad-planning-cell__editor">
          <select
            aria-label={`Manual squad role for ${playerName}`}
            disabled={isSaving}
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as SquadRole | "automatic")}
          >
            <option value="automatic">Automatic</option>
            {roleOptions().map((role) => (
              <option key={role} value={role}>
                {roleOptionLabel(role)}
              </option>
            ))}
          </select>
          <div className="atlas-squad-planning-cell__actions">
            <button
              aria-label={`Cancel squad role edit for ${playerName}`}
              className="atlas-squad-planning-cell__action is-cancel"
              disabled={isSaving}
              onClick={handleCancel}
              title="Cancel"
              type="button"
            >
              <RoleActionIcon type="cancel" />
            </button>
            <button
              aria-label={`Save squad role for ${playerName}`}
              className="atlas-squad-planning-cell__action is-confirm"
              disabled={isSaving}
              onClick={() => void handleConfirm()}
              title="Save squad role"
              type="button"
            >
              <RoleActionIcon type="confirm" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoleActionIcon({ type }: { type: "edit" | "cancel" | "confirm" }) {
  const path =
    type === "edit"
      ? "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
      : type === "cancel"
        ? "m6 6 12 12M18 6 6 18"
        : "m5 13 4 4L19 7";

  return (
    <svg aria-hidden="true" fill={type === "edit" ? "currentColor" : "none"} viewBox="0 0 24 24">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

interface SquadStatusIconProps {
  status: SquadPlayerRow["training"]["status"];
}

function SquadStatusIcon({ status }: SquadStatusIconProps) {
  if (status === null) {
    return null;
  }

  const path = status === "Info" ? "M12 8v4m0 4h.01" : "M12 7v6m0 4h.01";

  return (
    <span
      aria-label={`Status: ${status}`}
      className={`atlas-squad-player-status is-${status.toLowerCase()}`}
      role="img"
      title={status}
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d={path} stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </span>
  );
}

interface SquadMessageProps {
  children: ReactNode;
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
      return (
        diagnosticStringValue(parameters.playerName) +
        " es joven y muestra un buen ajuste para su rol."
      );
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
  return typeof value === "number" ? value.toLocaleString("es-AR") : diagnosticStringValue(value);
}
