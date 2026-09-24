import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  DevelopmentObjective,
  DevelopmentProfile,
  DevelopmentSkill,
  PlayerDevelopmentTargetOverride
} from "@atlas/domain";
import { PositionBadge } from "@/components/PositionBadge";
import { targetDefaultsForProfile, type DevelopmentPlanViewModel } from "./development-plan-view-model";

const PROFILE_CONFIGS: Record<
  DevelopmentProfile,
  { code: "GK" | "DEF" | "MID" | "ATT"; label: string }
> = {
  goalkeeper: { code: "GK", label: "Goalkeeper" },
  defender: { code: "DEF", label: "Defender" },
  midfielder: { code: "MID", label: "Midfielder" },
  forward: { code: "ATT", label: "Forward" }
};

interface EditDevelopmentTargetModalProps {
  plan: DevelopmentPlanViewModel;
  isSaving: boolean;
  onClose: () => void;
  onSave: (override: PlayerDevelopmentTargetOverride) => Promise<void>;
  onReset: () => Promise<void>;
}

export function EditDevelopmentTargetModal({
  plan,
  isSaving,
  onClose,
  onSave,
  onReset
}: EditDevelopmentTargetModalProps) {
  const [profile, setProfile] = useState<DevelopmentProfile>(plan.editor.profile);
  const [objective, setObjective] = useState<DevelopmentObjective>(plan.editor.objective);
  const [isCustomized, setIsCustomized] = useState<boolean>(plan.profile.source === "manual");
  const currentLevels = useMemo(
    () => Object.fromEntries(plan.targets.map((target) => [target.skill, target.currentLevel])),
    [plan.targets]
  );
  const [targetLevels, setTargetLevels] = useState<Partial<Record<DevelopmentSkill, number>>>(
    plan.editor.targetLevels
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleObjectiveChange = (nextObjective: DevelopmentObjective) => {
    setObjective(nextObjective);
    setIsCustomized(false);
    setTargetLevels(targetDefaultsForProfile(profile, currentLevels));
    setValidationError(null);
  };

  const profileSkills = Object.entries(
    profile === plan.editor.profile && objective === plan.editor.objective && isCustomized
      ? plan.editor.targetLevels
      : targetDefaultsForProfile(profile, currentLevels)
  ) as Array<[DevelopmentSkill, number]>;

  const handleProfileChange = (nextProfile: DevelopmentProfile) => {
    setProfile(nextProfile);
    setIsCustomized(false);
    setTargetLevels(targetDefaultsForProfile(nextProfile, currentLevels));
    setValidationError(null);
  };

  const handleTargetLevelChange = (skill: DevelopmentSkill, value: string) => {
    const level = Number(value);
    setIsCustomized(true);
    setTargetLevels((current) => ({ ...current, [skill]: level }));
    setValidationError(null);
  };

  const handleSubmit = async () => {
    if (isCustomized) {
      const invalid = profileSkills.some(([skill]) => {
        const level = targetLevels[skill];
        const current = currentLevels[skill] ?? 0;
        return (
          level === undefined ||
          !Number.isInteger(level) ||
          level < current ||
          level < 1 ||
          level > 18
        );
      });

      if (invalid) {
        setValidationError("Target levels must be whole numbers from the current level through 18.");
        return;
      }

      await onSave({ profile, objective, targetLevels });
    } else {
      await onSave({ profile, objective });
    }
  };

  const handleReset = async () => {
    await onReset();
    onClose();
  };

  return (
    <div className="atlas-player-development-plan__modal-backdrop" role="presentation">
      <section
        className="atlas-player-development-plan__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-development-target-title"
      >
        <div className="atlas-player-development-plan__modal-header">
          <h3 id="edit-development-target-title">Edit development target</h3>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="atlas-player-development-plan__profile-selector">
          <span className="atlas-player-development-plan__objective-label">Development Profile</span>
          <div
            className="atlas-player-development-plan__profile-buttons"
            role="group"
            aria-label="Development Profile"
          >
            {(Object.keys(PROFILE_CONFIGS) as DevelopmentProfile[]).map((profileKey) => {
              const config = PROFILE_CONFIGS[profileKey];
              const isActive = profile === profileKey;
              return (
                <button
                  key={profileKey}
                  type="button"
                  className={`atlas-player-development-plan__profile-button-item ${
                    isActive ? "is-active" : ""
                  }`}
                  onClick={() => handleProfileChange(profileKey)}
                >
                  <PositionBadge position={config.code} size="sm" />
                  <span className="atlas-profile-button-label">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="atlas-player-development-plan__objective-selector">
          <span className="atlas-player-development-plan__objective-label">Plan Objective</span>
          <div
            className="atlas-player-development-plan__dual-button"
            role="group"
            aria-label="Plan Objective"
          >
            <button
              type="button"
              className={`atlas-player-development-plan__dual-button-item ${
                objective === "sportive" ? "is-active is-sportive" : ""
              }`}
              onClick={() => handleObjectiveChange("sportive")}
            >
              <span className="atlas-dual-button-icon">⚽</span>
              <span className="atlas-dual-button-text">
                <strong>Sportive</strong>
                <small>Balanced performance</small>
              </span>
            </button>
            <button
              type="button"
              className={`atlas-player-development-plan__dual-button-item ${
                objective === "financial" ? "is-active is-financial" : ""
              }`}
              onClick={() => handleObjectiveChange("financial")}
            >
              <span className="atlas-dual-button-icon">💰</span>
              <span className="atlas-dual-button-text">
                <strong>Financial</strong>
                <small>Market resale value</small>
              </span>
            </button>
          </div>
        </div>
        <div className="atlas-player-development-plan__editor-skills">
          <span>Target skills</span>
          {profileSkills.map(([skill]) => (
            <label key={skill}>
              {skillLabel(skill)}
              <input
                aria-label={`${skillLabel(skill)} target level`}
                type="number"
                min={currentLevels[skill] ?? 0}
                max="18"
                step="1"
                value={targetLevels[skill] ?? ""}
                onChange={(event) => handleTargetLevelChange(skill, event.target.value)}
              />
            </label>
          ))}
        </div>
        {validationError ? (
          <p className="atlas-player-detail__message atlas-player-detail__message--warning">
            {validationError}
          </p>
        ) : null}
        <p className="atlas-player-development-plan__editor-note">
          Priorities come from the selected profile. Path and projection are recalculated after
          saving.
        </p>
        <div className="atlas-player-development-plan__modal-actions">
          <button type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          {plan.profile.source === "manual" ? (
            <button type="button" onClick={() => void handleReset()} disabled={isSaving}>
              Use ATLAS recommendation
            </button>
          ) : null}
          <button type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save target"}
          </button>
        </div>
      </section>
    </div>
  );
}

function skillLabel(skill: DevelopmentSkill): string {
  const labels: Record<DevelopmentSkill, string> = {
    stamina: "Stamina",
    pace: "Pace",
    technique: "Technique",
    passing: "Passing",
    keeper: "Keeper",
    defender: "Defending",
    playmaker: "Playmaking",
    striker: "Scoring"
  };
  return labels[skill];
}
