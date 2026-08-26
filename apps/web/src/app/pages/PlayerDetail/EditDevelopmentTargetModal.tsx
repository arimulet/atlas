import { useMemo, useState } from "react";
import type {
  DevelopmentProfile,
  DevelopmentSkill,
  PlayerDevelopmentTargetOverride
} from "@atlas/domain";
import {
  developmentProfileOptions,
  targetDefaultsForProfile,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";

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
  const currentLevels = useMemo(
    () => Object.fromEntries(plan.targets.map((target) => [target.skill, target.currentLevel])),
    [plan.targets]
  );
  const [targetLevels, setTargetLevels] = useState<Partial<Record<DevelopmentSkill, number>>>(
    plan.editor.targetLevels
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const profileSkills = Object.entries(
    profile === plan.editor.profile
      ? plan.editor.targetLevels
      : targetDefaultsForProfile(profile, currentLevels)
  ) as Array<[DevelopmentSkill, number]>;

  const handleProfileChange = (nextProfile: DevelopmentProfile) => {
    setProfile(nextProfile);
    setTargetLevels(targetDefaultsForProfile(nextProfile, currentLevels));
    setValidationError(null);
  };

  const handleTargetLevelChange = (skill: DevelopmentSkill, value: string) => {
    const level = Number(value);
    setTargetLevels((current) => ({ ...current, [skill]: level }));
    setValidationError(null);
  };

  const handleSubmit = async () => {
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

    await onSave({ profile, targetLevels });
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
            ×
          </button>
        </div>
        <label>
          Development profile
          <select
            value={profile}
            onChange={(event) => handleProfileChange(event.target.value as DevelopmentProfile)}
          >
            {developmentProfileOptions().map((option) => (
              <option key={option} value={option}>
                {profileLabel(option)}
              </option>
            ))}
          </select>
        </label>
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

function profileLabel(profile: DevelopmentProfile): string {
  return profile.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
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
