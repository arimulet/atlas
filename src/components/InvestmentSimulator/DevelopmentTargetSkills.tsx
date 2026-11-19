import { Award, Star, TrendingUp } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { formatSokkerSkill, skillLevelLabelEn } from "@/app/view-models/skill-level-label";
import type { PlayerAcquisitionSimulationInput } from "@atlas/domain";
import { ACQUISITION_POSITION_PROFILES, buildAcquisitionTargetGaps, type AcquisitionPosition } from "../../domain/financialStrategy/acquisition-targets";

interface TargetSkill {
  skill: string;
  current: number;
  target: number;
  priority: "primary" | "secondary" | "supporting";
}

const SKILL_COLUMNS = [
  ["stamina", "pace", "technique", "passing"],
  ["keeper", "defender", "playmaker", "striker"]
] as const;

const PRIORITY_ICONS = { primary: Star, secondary: TrendingUp, supporting: Award };

type TargetLevels = NonNullable<PlayerAcquisitionSimulationInput["targetLevels"]>;

function createDraft(skills: readonly TargetSkill[]): Record<string, string> {
  return Object.fromEntries(
    skills
      .filter((skill) => skill.skill !== "stamina")
      .map((skill) => [skill.skill, String(Math.max(skill.current, skill.target))])
  );
}

export function DevelopmentTargetSkills({
  skills,
  playerSkills,
  appliedPosition,
  onRecalculate,
  isRecalculating
}: {
  skills: readonly TargetSkill[];
  playerSkills: Record<string, number>;
  appliedPosition: AcquisitionPosition;
  onRecalculate: (targetLevels: TargetLevels, targetPosition: AcquisitionPosition) => Promise<unknown>;
  isRecalculating: boolean;
}) {
  const [draft, setDraft] = useState(() => createDraft(skills));
  const [position, setPosition] = useState<AcquisitionPosition>(appliedPosition);
  const [displaySkills, setDisplaySkills] = useState<readonly TargetSkill[] | null>(skills);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(createDraft(skills));
    setPosition(appliedPosition);
    setDisplaySkills(skills);
    setError(null);
  }, [skills, appliedPosition]);

  const loadPositionDefaults = (nextPosition: AcquisitionPosition) => {
    const defaults = buildAcquisitionTargetGaps(ACQUISITION_POSITION_PROFILES[nextPosition], playerSkills);
    setPosition(nextPosition);
    setDisplaySkills(defaults);
    setDraft(defaults ? createDraft(defaults) : {});
    setError(null);
  };

  const handleApply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displaySkills) return;
    const targetLevels: TargetLevels = {};
    for (const skill of displaySkills) {
      if (skill.skill === "stamina") continue;
      const value = Number(draft[skill.skill]);
      if (!draft[skill.skill] || !Number.isInteger(value) || value < skill.current || value > 18) {
        setError(`Target for ${skill.skill} must be between ${skill.current} and 18.`);
        return;
      }
      if (
        skill.skill === "keeper" ||
        skill.skill === "defender" ||
        skill.skill === "playmaker" ||
        skill.skill === "striker" ||
        skill.skill === "pace" ||
        skill.skill === "technique" ||
        skill.skill === "passing"
      ) {
        targetLevels[skill.skill] = value;
      }
    }
    setError(null);
    try {
      await onRecalculate(targetLevels, position);
    } catch {
      setError("Unable to recalculate the plan. Please try again.");
    }
  };

  const handleReset = () => loadPositionDefaults(position);

  return (
    <form className="atlas-acquisition-target-skills" onSubmit={handleApply}>
      <h4>Target skills</h4>
      <div className="atlas-acquisition-target-position">
        <span id="target-position-label">Target position</span>
        <div role="group" aria-labelledby="target-position-label">
          {(["GK", "DEF", "MID", "ATT"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={position === item}
              disabled={isRecalculating} onClick={() => { if (item !== position) loadPositionDefaults(item); }}>
              {item}
            </button>
          ))}
        </div>
        {position !== appliedPosition && <small>Position change not yet applied</small>}
      </div>
      {!displaySkills && <p className="atlas-finances-panel__message is-error" role="alert">Required skills for this position are unavailable.</p>}
      <div className="atlas-acquisition-target-layout">
      <div className="atlas-finances-simulator-sokker-grid">
        {SKILL_COLUMNS.map((column) => (
          <dl className="atlas-finances-simulator-sokker-col" key={column[0]}>
            {column.map((skill) => {
              const target = displaySkills?.find((item) => item.skill === skill);
              const Icon = target ? PRIORITY_ICONS[target.priority] : null;
              const draftValue =
                draft[skill] === undefined || draft[skill] === "" ? null : Number(draft[skill]);
              const displayedTarget =
                skill !== "stamina" && draftValue !== null && Number.isFinite(draftValue)
                  ? draftValue
                  : target?.target;
              const remaining =
                target && displayedTarget !== undefined
                  ? Math.max(0, displayedTarget - target.current)
                  : 0;
              return (
                <div className="atlas-finances-simulator-sokker-row" key={skill}>
                  <dt className="atlas-finances-simulator-sokker-label">
                    {Icon && target ? (
                      <span
                        className={`atlas-acquisition-priority is-${target.priority}`}
                        role="img"
                        tabIndex={0}
                        aria-label={`${target.priority} priority`}
                        data-tooltip={`${target.priority} priority`}
                      >
                        <Icon size={14} aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="atlas-acquisition-priority-placeholder" aria-hidden="true" />
                    )}
                    <span className="atlas-acquisition-skill-name">{skill}:</span>
                  </dt>
                  <dd className="atlas-finances-simulator-sokker-val">
                    {target && skill !== "stamina" ? (
                      <span className="atlas-acquisition-target-control">
                        <input
                          type="number"
                          min={target.current}
                          max={18}
                          step={1}
                          required
                          aria-label={`${skill} target`}
                          value={draft[skill] ?? ""}
                          disabled={isRecalculating}
                          onChange={(event) =>
                            setDraft((previous) => ({ ...previous, [skill]: event.target.value }))
                          }
                        />
                        <span>
                          {draft[skill] === "" ? "—" : skillLevelLabelEn(Number(draft[skill])) ?? "—"}
                        </span>
                      </span>
                    ) : target ? (
                      <span className="atlas-acquisition-target-control">
                        <span className="atlas-acquisition-target-readonly" aria-label={`stamina target ${target.target}`}>
                          {target.target}
                        </span>
                        <span>{skillLevelLabelEn(target.target) ?? formatSokkerSkill(target.target)}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                    {remaining > 0 ? (
                      <span className="atlas-acquisition-target-remaining">+{remaining}</span>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        ))}
      </div>
      <div className="atlas-acquisition-target-actions">
        <button type="submit" disabled={isRecalculating || !displaySkills}>
          {isRecalculating ? "Recalculating…" : "Recalculate plan"}
        </button>
        <button
          type="button"
          className="atlas-acquisition-target-reset"
          disabled={isRecalculating}
          onClick={handleReset}
        >
          Reset targets
        </button>
        <small>
          Changes apply when you recalculate. Set targets at or above the current level. Lower primary targets may leave Core unreached.
          Stamina is not trained separately.
        </small>
      </div>
      </div>
      {error ? (
        <p className="atlas-finances-panel__message is-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
