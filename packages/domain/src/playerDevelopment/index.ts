import {
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILE_ORDER,
  DEVELOPMENT_PROFILES,
  DEVELOPMENT_PROFILE_SIGNATURE_BONUSES,
  DEVELOPMENT_PROFILE_SIGNATURE_SKILLS
} from "./profiles.js";
import {
  createDevelopmentSimulationState,
  generateNextTrainingCandidates,
  selectBestTrainingCandidate,
  DEVELOPMENT_PATH_HIGH_RETURN_THRESHOLD,
  MAX_DEVELOPMENT_PATH_STEPS
} from "./training-path.js";
import type {
  DevelopmentPlayer,
  DevelopmentProfile,
  DevelopmentProfileEvaluation,
  DevelopmentProfileReason,
  DevelopmentProfileSuggestion,
  Formation,
  PlayerDevelopmentGap,
  PlayerDevelopmentTarget,
  PlayerDevelopmentTargetOverride,
  DevelopmentSkill
} from "./types.js";

export * from "./profiles.js";
export * from "./types.js";
export * from "./training-path-types.js";
export * from "./training-path.js";
export * from "./projection-types.js";
export * from "./projection.js";

const FORMATION_PROFILE_AFFINITY: Readonly<
  Record<Formation, Partial<Record<DevelopmentProfile, number>>>
> = {
  GK: { goalkeeper: 3 },
  DEF: { defender: 3, wing_defender: 2 },
  MID: { midfielder: 3, winger: 2 },
  ATT: { forward: 3 }
};

const POSITION_TO_FORMATION: Readonly<
  Record<NonNullable<DevelopmentPlayer["observedPosition"]>, Formation>
> = {
  goalkeeper: "GK",
  defender: "DEF",
  midfielder: "MID",
  winger: "MID",
  striker: "ATT"
};

export function suggestDevelopmentProfile(
  player: DevelopmentPlayer,
  override?: DevelopmentProfile | Pick<PlayerDevelopmentTarget, "profile"> | null
): DevelopmentProfileSuggestion {
  const manualProfile = readManualProfile(override);

  if (manualProfile) {
    return {
      profile: manualProfile,
      confidence: "high",
      reasons: [{ type: "manual_override", profile: manualProfile }]
    };
  }

  const evaluations = evaluateDevelopmentProfiles(player);
  const best = evaluations[0];

  if (!best || best.score === 0) {
    return { profile: "midfielder", confidence: "low", reasons: [] };
  }

  const secondBest = evaluations[1];
  const knownRelevantSkills = DEVELOPMENT_PROFILES[best.profile].relevantSkills.filter(
    ({ skill }) => readSkill(player, skill) !== null
  ).length;
  const formation = readFormation(player);
  const scoreMargin = best.score - (secondBest?.score ?? best.score);
  const formationProfile = strongestFormationProfile(formation);
  const currentFormationEvaluation = formationProfile
    ? evaluations.find((evaluation) => evaluation.profile === formationProfile)
    : undefined;
  const reasons = [...best.reasons];

  if (
    formation &&
    formationProfile &&
    best.profile !== formationProfile &&
    best.score > (currentFormationEvaluation?.score ?? 0) + 1
  ) {
    reasons.push({
      type: "profile_better_than_current_formation",
      currentFormation: formation,
      suggestedProfile: best.profile
    });
  }

  return {
    profile: best.profile,
    confidence: confidenceFromEvidence({
      formation,
      knownRelevantSkills,
      scoreMargin,
      bestScore: best.score
    }),
    reasons
  };
}

export function evaluateDevelopmentProfiles(
  player: DevelopmentPlayer
): DevelopmentProfileEvaluation[] {
  const formation = readFormation(player);

  return DEVELOPMENT_PROFILE_ORDER.map((profile) => {
    const definition = DEVELOPMENT_PROFILES[profile];
    const relevantSkills = definition.relevantSkills
      .map((item) => ({ ...item, level: readSkill(player, item.skill) }))
      .filter((item): item is typeof item & { level: number } => item.level !== null);
    const totalWeight = relevantSkills.reduce(
      (total, item) => total + DEVELOPMENT_PRIORITY_WEIGHTS[item.priority],
      0
    );
    const skillScore =
      totalWeight === 0
        ? 0
        : relevantSkills.reduce(
            (total, item) => total + item.level * DEVELOPMENT_PRIORITY_WEIGHTS[item.priority],
            0
          ) / totalWeight;
    const formationScore = formation ? (FORMATION_PROFILE_AFFINITY[formation][profile] ?? 0) : 0;
    const signatureSkill = DEVELOPMENT_PROFILE_SIGNATURE_SKILLS[profile];
    const signatureLevel = readSkill(player, signatureSkill) ?? 0;
    const signatureScore =
      signatureLevel >= 10 ? DEVELOPMENT_PROFILE_SIGNATURE_BONUSES[profile] : 0;
    const reasons: DevelopmentProfileReason[] = [];

    if (formationScore > 0 && formation !== null) {
      reasons.push({ type: "formation_match", formation });
    }

    const strongestSkill = relevantSkills
      .filter((item) => item.level >= 10)
      .sort((left, right) => right.level - left.level)[0];

    if (strongestSkill) {
      reasons.push({
        type: "strong_skill",
        skill: strongestSkill.skill,
        level: strongestSkill.level
      });
    }

    if (relevantSkills.length >= 2) {
      reasons.push({ type: "profile_skill_distribution", profile });
    }

    return {
      profile,
      score: skillScore + formationScore + signatureScore,
      reasons
    };
  }).sort(
    (left, right) =>
      right.score - left.score || profileOrder(left.profile) - profileOrder(right.profile)
  );
}

export function buildIdealDevelopmentTarget(
  player: DevelopmentPlayer,
  profile: DevelopmentProfile,
  source: "automatic" | "manual" = "automatic"
): PlayerDevelopmentTarget {
  const definition = DEVELOPMENT_PROFILES[profile];
  const targetSkills = definition.relevantSkills.map(({ skill, priority, defaultTargetLevel }) => {
    return {
      skill,
      targetLevel: defaultTargetLevel,
      priority,
      reasons: [{ type: "primary_skill" } as const] // We can refine this later
    };
  });

  return {
    playerId: player.playerId,
    profile,
    targetSkills,
    source
  };
}

export function buildOperationalDevelopmentTarget(
  player: DevelopmentPlayer,
  idealTarget: PlayerDevelopmentTarget,
  horizonAge: number,
  override: PlayerDevelopmentTargetOverride = {}
): PlayerDevelopmentTarget {
  const context = {
    player: {
      ...player,
      age: player.age ?? 18
    },
    target: idealTarget
  };

  const state = createDevelopmentSimulationState(context);
  const operationalTargetSkills = idealTarget.targetSkills.map(skill => ({
    skill: skill.skill,
    targetLevel: state.skills[skill.skill] ?? 0,
    priority: skill.priority,
    reasons: [] as import("./types.js").DevelopmentTargetReason[]
  }));

  while (state.stepsCompleted < MAX_DEVELOPMENT_PATH_STEPS) {
    const candidates = generateNextTrainingCandidates(context, state);
    const validCandidates = candidates.filter(
      c => c.estimatedAgeAtStep < horizonAge && c.developmentReturnScore >= DEVELOPMENT_PATH_HIGH_RETURN_THRESHOLD
    );

    const best = selectBestTrainingCandidate(validCandidates, state.lastSkill);
    if (!best) break;

    state.skills[best.skill] = best.toLevel;
    state.accumulatedTrainingPoints += best.requiredTrainingPoints;
    state.estimatedElapsedWeeks += best.estimatedWeeks;
    state.estimatedAge = best.estimatedAgeAtStep;
    state.stepsCompleted += 1;
    state.lastSkill = best.skill;

    const targetSkill = operationalTargetSkills.find(s => s.skill === best.skill);
    if (targetSkill) {
      targetSkill.targetLevel = best.toLevel;
      targetSkill.reasons = [
        { type: "within_development_horizon", age: best.estimatedAgeAtStep },
        { type: "positive_marginal_return", score: best.developmentReturnScore }
      ];
    }
  }

  // Ensure all skills have at least primary_skill reason if they were already included without steps
  for (const targetSkill of operationalTargetSkills) {
    if (targetSkill.reasons.length === 0) {
      targetSkill.reasons = [{ type: "primary_skill" }];
    }
  }

  if (override.targetLevels) {
    for (const skill of operationalTargetSkills) {
      if (override.targetLevels[skill.skill] !== undefined) {
        skill.targetLevel = Math.max(player.skills[skill.skill] ?? 0, override.targetLevels[skill.skill]);
        skill.reasons = [{ type: "manual_override" }];
      }
    }
  }

  return {
    playerId: player.playerId,
    profile: idealTarget.profile,
    targetSkills: operationalTargetSkills,
    source: hasManualOverride(override) ? "manual" : "automatic"
  };
}

export function calculateDevelopmentGap(
  player: DevelopmentPlayer,
  target: PlayerDevelopmentTarget
): PlayerDevelopmentGap {
  const skills = target.targetSkills.map((targetSkill) => {
    const currentLevel = readSkill(player, targetSkill.skill) ?? 0;
    const levelsRemaining = Math.max(targetSkill.targetLevel - currentLevel, 0);

    return {
      skill: targetSkill.skill,
      currentLevel,
      targetLevel: targetSkill.targetLevel,
      levelsRemaining,
      priority: targetSkill.priority,
      completed: levelsRemaining === 0
    };
  });
  const totalGap = skills.reduce((total, skill) => total + skill.levelsRemaining, 0);
  const totalWeight = skills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const completedWeight = skills.reduce((total, skill) => {
    const weight = DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority];
    const completion =
      skill.targetLevel > 0
        ? Math.min(skill.currentLevel, skill.targetLevel) / skill.targetLevel
        : 1;

    return total + completion * weight;
  }, 0);

  return {
    playerId: player.playerId,
    profile: target.profile,
    skills,
    totalGap,
    progress: totalWeight === 0 ? 1 : clamp(completedWeight / totalWeight, 0, 1)
  };
}

export function isDevelopmentTargetCompleted(gap: PlayerDevelopmentGap): boolean {
  return gap.skills.length > 0 && gap.skills.every((skill) => skill.completed);
}

export interface PlayerDevelopmentPlan {
  suggestion: DevelopmentProfileSuggestion;
  idealTarget: PlayerDevelopmentTarget;
  target: PlayerDevelopmentTarget;
  gap: PlayerDevelopmentGap;
}

export class PlayerDevelopmentPlanner {
  constructor(private readonly config: { developmentHorizonAge: number } = { developmentHorizonAge: 32 }) {}

  suggest(player: DevelopmentPlayer): DevelopmentProfileSuggestion {
    return suggestDevelopmentProfile(player);
  }

  buildDefaultTarget(
    player: DevelopmentPlayer,
    profile: DevelopmentProfile,
    override: PlayerDevelopmentTargetOverride = {}
  ): PlayerDevelopmentTarget {
    const ideal = buildIdealDevelopmentTarget(player, profile, hasManualOverride(override) ? "manual" : "automatic");
    return buildOperationalDevelopmentTarget(player, ideal, this.config.developmentHorizonAge, override);
  }

  calculateGap(player: DevelopmentPlayer, target: PlayerDevelopmentTarget): PlayerDevelopmentGap {
    return calculateDevelopmentGap(player, target);
  }

  createPlan(
    player: DevelopmentPlayer,
    override: PlayerDevelopmentTargetOverride = {}
  ): PlayerDevelopmentPlan {
    const suggestion = suggestDevelopmentProfile(player);
    const profile = override.profile ?? suggestion.profile;
    const idealTarget = buildIdealDevelopmentTarget(player, profile, hasManualOverride(override) ? "manual" : "automatic");
    const target = buildOperationalDevelopmentTarget(player, idealTarget, this.config.developmentHorizonAge, override);

    return { suggestion, idealTarget, target, gap: calculateDevelopmentGap(player, target) };
  }
}

function readManualProfile(
  override: DevelopmentProfile | Pick<PlayerDevelopmentTarget, "profile"> | null | undefined
): DevelopmentProfile | null {
  if (typeof override === "string") return override;
  return override?.profile ?? null;
}

function readFormation(player: DevelopmentPlayer): Formation | null {
  if (player.formation) return player.formation;
  if (player.position) return player.position;
  return player.observedPosition ? POSITION_TO_FORMATION[player.observedPosition] : null;
}

function readSkill(player: DevelopmentPlayer, skill: DevelopmentSkill): number | null {
  const value = player.skills[skill];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : null;
}

function confidenceFromEvidence(input: {
  formation: Formation | null;
  knownRelevantSkills: number;
  scoreMargin: number;
  bestScore: number;
}): "low" | "medium" | "high" {
  if (input.knownRelevantSkills < 2 && !input.formation) return "low";
  if (input.knownRelevantSkills < 2) return "low";
  if (input.knownRelevantSkills >= 3 && (input.scoreMargin >= 1.5 || input.bestScore >= 12)) {
    return "high";
  }
  return "medium";
}

function strongestFormationProfile(formation: Formation | null): DevelopmentProfile | null {
  if (!formation) return null;

  return (
    (Object.entries(FORMATION_PROFILE_AFFINITY[formation]).sort(
      ([, left], [, right]) => (right ?? 0) - (left ?? 0)
    )[0]?.[0] as DevelopmentProfile | undefined) ?? null
  );
}

function profileOrder(profile: DevelopmentProfile): number {
  return DEVELOPMENT_PROFILE_ORDER.indexOf(profile);
}

function hasManualOverride(override: PlayerDevelopmentTargetOverride): boolean {
  return (
    override.profile !== undefined ||
    override.targetLevels !== undefined
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
