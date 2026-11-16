"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { formatSokkerSkill } from "@/app/view-models/skill-level-label";

const SKILL_COLUMNS = [
  [
    ["stamina", "stamina"],
    ["pace", "pace"],
    ["technique", "technique"],
    ["passing", "passing"]
  ],
  [
    ["keeper", "keeper"],
    ["defender", "defender"],
    ["playmaker", "playmaker"],
    ["striker", "striker"]
  ]
] as const;

interface ProjectedSkillsTooltipProps {
  skills: Record<string, number>;
  week: number;
  calendarLabel?: string;
}

export function ProjectedSkillsTooltip({
  skills,
  week,
  calendarLabel
}: ProjectedSkillsTooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number; below: boolean } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!position) return;
    const handleDismiss = () => setPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDismiss();
    };
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [position]);

  const handleShow = () => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(600, window.innerWidth - 16);
    setPosition({
      top: bounds.top < 280 ? bounds.bottom + 8 : bounds.top - 8,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
      below: bounds.top < 280
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="atlas-acquisition-skill-trigger"
        aria-label={`Show projected skills ${calendarLabel ?? `after ${week} weeks`}`}
        aria-describedby={position ? tooltipId : undefined}
        onMouseEnter={handleShow}
        onMouseLeave={() => setPosition(null)}
        onFocus={handleShow}
        onBlur={() => setPosition(null)}
        onClick={handleShow}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="atlas-acquisition-skill-tooltip"
            style={{
              top: position.top,
              left: position.left,
              transform: position.below ? undefined : "translateY(-100%)"
            }}
          >
            <strong>Projected skills · {calendarLabel ?? `after ${week} weeks`}</strong>
            <div className="atlas-acquisition-skill-tooltip__grid">
              {SKILL_COLUMNS.map((column) => (
                <dl key={column[0][0]}>
                  {column.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}:</dt>
                      <dd>{skills[key] === undefined ? "—" : formatSokkerSkill(skills[key])}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
