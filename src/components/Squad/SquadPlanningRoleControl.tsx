import { useState } from "react";
import type { SquadDepthPlayer, SquadRole } from "@atlas/domain";
import {
  describeManualRoleConflict,
  roleOptionLabel,
  roleOptions
} from "./SquadPlanningSections";
import {
  formatContributionScore,
  lifecycleLabel,
  roleLabel
} from "./squad-planning-view-model";

export interface SquadPlanningRoleControlProps {
  onSaveSquadRole: (playerId: string, role: SquadRole | null) => Promise<void>;
  playerId: string;
  playerName: string;
  planningPlayer: SquadDepthPlayer | null;
}

export function SquadPlanningRoleControl({
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
    return <span className="atlas-squad-table__empty-role">—</span>;
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

export function RoleActionIcon({ type }: { type: "edit" | "cancel" | "confirm" }) {
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
