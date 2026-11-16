import { Award, Star, TrendingUp } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { formatSokkerSkill } from "@/app/view-models/skill-level-label";
import type { PlayerAcquisitionSimulationInput } from "@atlas/domain";

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
  onRecalculate,
  isRecalculating
}: {
  skills: readonly TargetSkill[];
  onRecalculate: (targetLevels: TargetLevels) => Promise<unknown>;
  isRecalculating: boolean;
}) {
  const [draft, setDraft] = useState(() => createDraft(skills));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(createDraft(skills));
    setError(null);
  }, [skills]);

  const handleApply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetLevels: TargetLevels = {};
    for (const skill of skills) {
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
      await onRecalculate(targetLevels);
    } catch {
      setError("Unable to recalculate the plan. Please try again.");
    }
  };

  const handleReset = async () => {
    setError(null);
    try {
      await onRecalculate({});
    } catch {
      setError("Unable to restore default targets. Please try again.");
    }
  };

  return (
    <form className="atlas-acquisition-target-skills" onSubmit={handleApply}>
      <h4>Target skills</h4>
      <div className="atlas-finances-simulator-sokker-grid">
        {SKILL_COLUMNS.map((column) => (
          <dl className="atlas-finances-simulator-sokker-col" key={column[0]}>
            {column.map((skill) => {
              const target = skills.find((item) => item.skill === skill);
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
                          {draft[skill] === "" ? "—" : formatSokkerSkill(Number(draft[skill]))}
                        </span>
                      </span>
                    ) : target ? (
                      formatSokkerSkill(target.target)
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
        <button type="submit" disabled={isRecalculating}>
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
          Set targets at or above the current level. Lower primary targets may leave Core unreached.
          Stamina is not trained separately.
        </small>
      </div>
      {error ? (
        <p className="atlas-finances-panel__message is-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
