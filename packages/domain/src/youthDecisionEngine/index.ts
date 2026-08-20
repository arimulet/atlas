import {
  BASE_TRAINING_AGE,
  calculateAgeTrainingCostFactor,
  calculateRelativeTrainingSpeed,
  MAX_SKILL_LEVEL,
  type TalentEstimate,
  type TrainingHistory
} from "../training/index.js";
import {
  buildDefaultDevelopmentTarget,
  DEVELOPMENT_PRIORITY_WEIGHTS,
  DEVELOPMENT_PROFILES,
  evaluateDevelopmentProfiles,
  suggestDevelopmentProfile,
  type DevelopmentPlayer,
  type DevelopmentProfile,
  type DevelopmentProfileDefinition,
  type DevelopmentProfileSuggestion,
  type DevelopmentSkill
} from "../playerDevelopment/index.js";
import { SUPPORTED_SKILLS } from "../constants.js";
import type { Confidence, SkillKey } from "../types.js";
import type {
  YouthProspectAssessment,
  YouthProspectContext,
  YouthProspectDiagnostic,
  YouthProspectReason,
  YouthProspectStrength,
  YouthProspectWeakness
} from "./types.js";
import {
  assessYouthDevelopmentOpportunity,
  assessYouthStrategicAssessment,
  evaluateYouthDevelopmentOpportunities
} from "./fit.js";
import type {
  YouthDevelopmentOpportunity,
  YouthFitConfig,
  YouthFitContext,
  YouthStrategicAssessment
} from "./fit-types.js";
import { evaluateYouthDecisions, recommendYouthDecision } from "./decision.js";

export * from "./types.js";
export * from "./fit-types.js";
export * from "./decision-types.js";
export {
  evaluateYouthDecisions,
  recommendYouthDecision,
  summarizeYouthDecisions,
  YouthDecisionRecommendationService
} from "./decision.js";
export {
  assessYouthDevelopmentOpportunity,
  assessYouthStrategicAssessment,
  evaluateYouthDevelopmentOpportunities
} from "./fit.js";

const QUALITY_AGE_ADJUSTMENT_FLOOR = 0.55;
const PRIMARY_SKILL_STRENGTH_LEVEL = 10;
const LOW_PRIMARY_SKILL_AVERAGE = 7;
const HIGH_POTENTIAL_THRESHOLD = 0.7;
const LIMITED_POTENTIAL_THRESHOLD = 0.3;
const CLEAR_PROFILE_COHERENCE_THRESHOLD = 0.7;
const UNCLEAR_PROFILE_COHERENCE_THRESHOLD = 0.5;

export function assessYouthProspect(context: YouthProspectContext): YouthProspectAssessment {
  const player = context.player;
  const profileSuggestion = resolveProfileSuggestion(context);
  const profile = profileSuggestion?.profile ?? null;
  const profileDefinition = profile ? DEVELOPMENT_PROFILES[profile] : null;
  const profileSkills = profileDefinition ? readProfileSkills(player, profileDefinition) : [];
  const allSkills = readKnownSkills(player);
  const validAge = readValidAge(player.age);
  const profileCoherenceScore =
    profile && profileDefinition
      ? calculateProfileCoherence(profileSkills, allSkills, profileDefinition)
      : null;
  const currentQualityScore =
    profile && profileDefinition
      ? calculateCurrentQuality(profileSkills, validAge, profileDefinition)
      : calculateFallbackCurrentQuality(allSkills, validAge);
  const suggestedDevelopmentTarget =
    profile && (context.includeSuggestedDevelopmentTarget ?? true)
      ? buildDefaultDevelopmentTarget(player, profile)
      : null;
  const developmentPotentialScore = profile
    ? calculateDevelopmentPotential({
        player,
        profileSkills,
        profile,
        profileCoherenceScore,
        talent: context.talent,
        validAge
      })
    : null;
  const prospectScore = calculateProspectScore({
    currentQualityScore,
    developmentPotentialScore,
    profileCoherenceScore
  });
  const confidence = calculateAssessmentConfidence({
    profileSuggestion,
    profileSkills,
    profileCoherenceScore,
    player,
    talent: context.talent,
    trainingHistory: context.trainingHistory
  });
  const reasons = buildReasons({
    profileSuggestion,
    profile,
    profileCoherenceScore,
    validAge,
    player,
    talent: context.talent,
    trainingHistory: context.trainingHistory,
    suggestedDevelopmentTarget
  });
  const strengths = buildStrengths({
    player,
    profileSkills,
    profile,
    profileCoherenceScore,
    currentQualityScore,
    developmentPotentialScore
  });
  const weaknesses = buildWeaknesses({
    player,
    profileSkills,
    profile,
    profileCoherenceScore,
    currentQualityScore,
    developmentPotentialScore
  });

  return {
    playerId: player.playerId,
    suggestedProfile: profile,
    profileCoherenceScore,
    currentQualityScore,
    developmentPotentialScore,
    prospectScore,
    confidence,
    strengths,
    weaknesses,
    reasons,
    suggestedDevelopmentTarget
  };
}

export function assessYouthProspects(
  contexts: readonly YouthProspectContext[]
): YouthProspectAssessment[] {
  return contexts.map(assessYouthProspect).sort(compareYouthProspectAssessments);
}

export function buildYouthProspectDiagnostic(
  context: YouthProspectContext | YouthProspectAssessment
): YouthProspectDiagnostic {
  const assessment = isAssessment(context) ? context : assessYouthProspect(context);

  return {
    playerId: assessment.playerId,
    age: isAssessment(context) ? null : readValidAge(context.player.age),
    profile: assessment.suggestedProfile,
    currentQualityScore: assessment.currentQualityScore,
    developmentPotentialScore: assessment.developmentPotentialScore,
    profileCoherenceScore: assessment.profileCoherenceScore,
    prospectScore: assessment.prospectScore,
    confidence: assessment.confidence
  };
}

export class YouthDecisionEngine {
  assessProspect(context: YouthProspectContext): YouthProspectAssessment {
    return assessYouthProspect(context);
  }

  assessProspects(contexts: readonly YouthProspectContext[]): YouthProspectAssessment[] {
    return assessYouthProspects(contexts);
  }

  diagnoseProspect(context: YouthProspectContext): YouthProspectDiagnostic {
    return buildYouthProspectDiagnostic(context);
  }

  assessFit(
    context: YouthFitContext,
    config: Partial<YouthFitConfig> = {}
  ): YouthDevelopmentOpportunity {
    return assessYouthDevelopmentOpportunity(context, config);
  }

  assessStrategic(
    context: YouthFitContext,
    config: Partial<YouthFitConfig> = {}
  ): YouthStrategicAssessment {
    return assessYouthStrategicAssessment(context, config);
  }

  assessFits(
    contexts: readonly YouthFitContext[],
    config: Partial<YouthFitConfig> = {}
  ): YouthDevelopmentOpportunity[] {
    return evaluateYouthDevelopmentOpportunities(contexts, config);
  }

  recommend(
    context: import("./decision-types.js").YouthDecisionContext,
    config: Partial<import("./decision-types.js").YouthDecisionConfig> = {}
  ): import("./decision-types.js").YouthDecisionRecommendation {
    return recommendYouthDecision(context, config);
  }

  evaluateDecisions(
    contexts: readonly import("./decision-types.js").YouthDecisionContext[],
    config: Partial<import("./decision-types.js").YouthDecisionConfig> = {}
  ): import("./decision-types.js").YouthDecisionRecommendation[] {
    return evaluateYouthDecisions(contexts, config);
  }
}

function resolveProfileSuggestion(
  context: YouthProspectContext
): DevelopmentProfileSuggestion | null {
  if (context.suggestedDevelopmentProfile) return context.suggestedDevelopmentProfile;

  const evaluations = evaluateDevelopmentProfiles(context.player);
  const best = evaluations[0];
  const hasFormationEvidence = Boolean(
    best?.reasons.some((reason) => reason.type === "formation_match")
  );
  const hasSkillEvidence = Boolean(best && best.score > 0);

  if (!hasFormationEvidence && !hasSkillEvidence) return null;

  return suggestDevelopmentProfile(context.player);
}

function readProfileSkills(
  player: DevelopmentPlayer,
  definition: DevelopmentProfileDefinition
): Array<{
  skill: DevelopmentSkill;
  priority: "primary" | "secondary" | "supporting";
  level: number;
}> {
  return definition.relevantSkills.flatMap((definitionSkill) => {
    const level = readSkill(player.skills[definitionSkill.skill]);
    return level === null ? [] : [{ ...definitionSkill, level }];
  });
}

function readKnownSkills(player: DevelopmentPlayer): Array<{ skill: SkillKey; level: number }> {
  return (Object.entries(player.skills) as Array<[SkillKey, number | null | undefined]>).flatMap(
    ([skill, value]) => {
      const level = readSkill(value);
      return level === null ? [] : [{ skill, level }];
    }
  );
}

function readSkill(value: number | null | undefined): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_SKILL_LEVEL
    ? value
    : null;
}

function readValidAge(age: number | null | undefined): number | null {
  return typeof age === "number" && Number.isFinite(age) && age >= BASE_TRAINING_AGE ? age : null;
}

function calculateCurrentQuality(
  profileSkills: ReturnType<typeof readProfileSkills>,
  age: number | null,
  definition: DevelopmentProfileDefinition
): number | null {
  if (profileSkills.length === 0) return null;

  const weightedLevel = profileSkills.reduce(
    (total, item) => total + item.level * DEVELOPMENT_PRIORITY_WEIGHTS[item.priority],
    0
  );
  const targetQuality = definition.relevantSkills.reduce(
    (total, skill) =>
      total + skill.defaultTargetLevel * DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const rawQuality = weightedLevel / targetQuality;
  const ageAdjustment = age === null ? 1 : ageQualityAdjustment(age);
  return roundScore(rawQuality * ageAdjustment);
}

function calculateFallbackCurrentQuality(
  allSkills: Array<{ skill: SkillKey; level: number }>,
  age: number | null
): number | null {
  if (allSkills.length === 0) return null;
  const rawQuality =
    allSkills.reduce((total, skill) => total + skill.level, 0) /
    (allSkills.length * MAX_SKILL_LEVEL);
  return roundScore(rawQuality * (age === null ? 1 : ageQualityAdjustment(age)));
}

function ageQualityAdjustment(age: number): number {
  return clamp(calculateRelativeTrainingSpeed(age), QUALITY_AGE_ADJUSTMENT_FLOOR, 1);
}

function calculateProfileCoherence(
  profileSkills: ReturnType<typeof readProfileSkills>,
  allSkills: Array<{ skill: SkillKey; level: number }>,
  definition: DevelopmentProfileDefinition
): number | null {
  if (profileSkills.length === 0 || allSkills.length === 0) return null;

  const profileSkillNames = new Set(definition.relevantSkills.map(({ skill }) => skill));
  const totalProfileWeight = definition.relevantSkills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const knownProfileWeight = profileSkills.reduce(
    (total, skill) => total + DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const profileContribution = profileSkills.reduce(
    (total, skill) => total + skill.level * DEVELOPMENT_PRIORITY_WEIGHTS[skill.priority],
    0
  );
  const outsideContribution = allSkills
    .filter(({ skill }) => !profileSkillNames.has(skill))
    .reduce((total, skill) => total + skill.level, 0);
  const focusRatio = profileContribution / Math.max(profileContribution + outsideContribution, 1);
  const coverage = knownProfileWeight / totalProfileWeight;

  return roundScore(coverage * 0.6 + focusRatio * 0.4);
}

function calculateDevelopmentPotential(input: {
  player: DevelopmentPlayer;
  profileSkills: ReturnType<typeof readProfileSkills>;
  profile: DevelopmentProfile;
  profileCoherenceScore: number | null;
  talent?: TalentEstimate | null;
  validAge: number | null;
}): number | null {
  if (input.profileSkills.length === 0) return null;

  const target = buildDefaultDevelopmentTarget(input.player, input.profile);
  const targetBySkill = new Map(target.targetSkills.map((skill) => [skill.skill, skill]));
  const observedTargetSkills = input.profileSkills.flatMap((skill) => {
    const targetSkill = targetBySkill.get(skill.skill);
    return targetSkill ? [{ currentLevel: skill.level, targetSkill }] : [];
  });
  if (observedTargetSkills.length === 0) return null;

  const targetWeight = observedTargetSkills.reduce(
    (total, item) =>
      total +
      item.targetSkill.targetLevel * DEVELOPMENT_PRIORITY_WEIGHTS[item.targetSkill.priority],
    0
  );
  const remainingWeight = observedTargetSkills.reduce(
    (total, item) =>
      total +
      Math.max(item.targetSkill.targetLevel - item.currentLevel, 0) *
        DEVELOPMENT_PRIORITY_WEIGHTS[item.targetSkill.priority],
    0
  );
  if (targetWeight <= 0) return null;

  const remainingRatio = remainingWeight / targetWeight;
  const ageFactor = input.validAge === null ? 1 : agePotentialFactor(input.validAge);
  const talentFactor = talentPotentialFactor(input.talent);
  const coherenceFactor =
    input.profileCoherenceScore === null ? 1 : 0.85 + input.profileCoherenceScore * 0.15;
  return roundScore(remainingRatio * ageFactor * talentFactor * coherenceFactor);
}

function agePotentialFactor(age: number): number {
  return clamp(1 / Math.sqrt(Math.max(calculateAgeTrainingCostFactor(age), 1)), 0.25, 1);
}

function talentPotentialFactor(talent: TalentEstimate | null | undefined): number {
  if (!talent || talent.value === null || !Number.isFinite(talent.value)) return 1;

  const confidenceWeight =
    talent.confidence === "high" ? 1 : talent.confidence === "medium" ? 0.5 : 0.15;
  const signal = clamp((talent.value - 0.9) / 0.6, -1, 1);
  return clamp(1 + signal * 0.2 * confidenceWeight, 0.85, 1.15);
}

function calculateProspectScore(input: {
  currentQualityScore: number | null;
  developmentPotentialScore: number | null;
  profileCoherenceScore: number | null;
}): number | null {
  const components = [
    { value: input.currentQualityScore, weight: 0.4 },
    { value: input.developmentPotentialScore, weight: 0.4 },
    { value: input.profileCoherenceScore, weight: 0.2 }
  ].filter((component): component is { value: number; weight: number } => component.value !== null);
  if (components.length === 0) return null;
  const totalWeight = components.reduce((total, component) => total + component.weight, 0);
  return roundScore(
    components.reduce((total, component) => total + component.value * component.weight, 0) /
      totalWeight
  );
}

function calculateAssessmentConfidence(input: {
  profileSuggestion: DevelopmentProfileSuggestion | null;
  profileSkills: ReturnType<typeof readProfileSkills>;
  profileCoherenceScore: number | null;
  player: DevelopmentPlayer;
  talent?: TalentEstimate | null;
  trainingHistory?: readonly TrainingHistory[];
}): Confidence {
  if (!input.profileSuggestion || input.profileSuggestion.confidence === "low") return "low";

  const completeProfile = input.profileSkills.length >= 3;
  const usefulHistory = countTrainingObservations(input.trainingHistory) >= 3;
  const reliableTalent = input.talent?.confidence === "high" && input.talent.value !== null;
  if (
    completeProfile &&
    input.profileCoherenceScore !== null &&
    input.profileCoherenceScore >= CLEAR_PROFILE_COHERENCE_THRESHOLD &&
    (usefulHistory || reliableTalent)
  ) {
    return "high";
  }

  if (input.profileSkills.length >= 2 && readValidAge(input.player.age) !== null) return "medium";
  return "low";
}

function buildReasons(input: {
  profileSuggestion: DevelopmentProfileSuggestion | null;
  profile: DevelopmentProfile | null;
  profileCoherenceScore: number | null;
  validAge: number | null;
  player: DevelopmentPlayer;
  talent?: TalentEstimate | null;
  trainingHistory?: readonly TrainingHistory[];
  suggestedDevelopmentTarget: YouthProspectAssessment["suggestedDevelopmentTarget"];
}): YouthProspectReason[] {
  const reasons: YouthProspectReason[] = [];
  if (input.profile && input.profileSuggestion) {
    reasons.push({
      type: "profile_detected",
      profile: input.profile,
      confidence: input.profileSuggestion.confidence
    });
  } else {
    reasons.push({ type: "profile_not_inferable" });
  }
  reasons.push({
    type: "age_adjustment",
    relativeTrainingSpeed:
      input.validAge === null ? null : calculateRelativeTrainingSpeed(input.validAge)
  });
  if (input.profileCoherenceScore !== null) {
    reasons.push({ type: "profile_coherence", score: input.profileCoherenceScore });
  }
  const primarySkill = input.profile
    ? readProfileSkills(input.player, DEVELOPMENT_PROFILES[input.profile])
        .filter((skill) => skill.priority === "primary")
        .sort((left, right) => right.level - left.level)[0]
    : undefined;
  if (primarySkill && primarySkill.level >= PRIMARY_SKILL_STRENGTH_LEVEL) {
    reasons.push({
      type: "strong_primary_skill",
      skill: primarySkill.skill,
      level: primarySkill.level
    });
  }
  const missingSkills = SUPPORTED_SKILLS.filter(
    (skill) => readSkill(input.player.skills[skill]) === null
  );
  if (missingSkills.length > 0) reasons.push({ type: "incomplete_skills", missingSkills });
  if (input.validAge === null) reasons.push({ type: "invalid_age" });
  if (
    input.talent?.value !== null &&
    input.talent?.value !== undefined &&
    Number.isFinite(input.talent.value)
  ) {
    reasons.push({
      type: "talent_evidence",
      confidence:
        input.talent.confidence === "high"
          ? "high"
          : input.talent.confidence === "medium"
            ? "medium"
            : "low",
      value: input.talent.value
    });
  }
  const observationCount = countTrainingObservations(input.trainingHistory);
  if (observationCount > 0) reasons.push({ type: "training_evidence", observationCount });
  if (input.suggestedDevelopmentTarget && input.profile) {
    reasons.push({ type: "automatic_development_target", profile: input.profile });
  }
  return reasons;
}

function buildStrengths(input: {
  player: DevelopmentPlayer;
  profileSkills: ReturnType<typeof readProfileSkills>;
  profile: DevelopmentProfile | null;
  profileCoherenceScore: number | null;
  currentQualityScore: number | null;
  developmentPotentialScore: number | null;
}): YouthProspectStrength[] {
  const strengths: YouthProspectStrength[] = [];
  const primarySkill = input.profileSkills
    .filter((skill) => skill.priority === "primary")
    .sort((left, right) => right.level - left.level)[0];

  const age = readValidAge(input.player.age);
  if (age !== null && age <= 18 && (input.currentQualityScore ?? 0) >= 0.45) {
    strengths.push({ type: "young_for_skill_level" });
  }
  if (primarySkill && primarySkill.level >= PRIMARY_SKILL_STRENGTH_LEVEL) {
    strengths.push({
      type: "strong_primary_skill",
      skill: primarySkill.skill,
      level: primarySkill.level
    });
  }
  if (
    input.profileCoherenceScore !== null &&
    input.profileCoherenceScore >= CLEAR_PROFILE_COHERENCE_THRESHOLD
  ) {
    strengths.push({ type: "balanced_profile" });
  }
  if (
    input.developmentPotentialScore !== null &&
    input.developmentPotentialScore >= HIGH_POTENTIAL_THRESHOLD
  ) {
    strengths.push({ type: "high_development_potential" });
  }
  if (
    input.profile &&
    input.profileCoherenceScore !== null &&
    input.profileCoherenceScore >= CLEAR_PROFILE_COHERENCE_THRESHOLD
  ) {
    strengths.push({ type: "clear_profile_fit", profile: input.profile });
  }
  return strengths;
}

function buildWeaknesses(input: {
  player: DevelopmentPlayer;
  profileSkills: ReturnType<typeof readProfileSkills>;
  profile: DevelopmentProfile | null;
  profileCoherenceScore: number | null;
  currentQualityScore: number | null;
  developmentPotentialScore: number | null;
}): YouthProspectWeakness[] {
  const weaknesses: YouthProspectWeakness[] = [];
  const primarySkills = input.profileSkills.filter((skill) => skill.priority === "primary");
  const primaryAverage = average(primarySkills);
  const age = readValidAge(input.player.age);
  if (age !== null && age >= 19 && (input.currentQualityScore ?? 0) < 0.45) {
    weaknesses.push({ type: "older_for_skill_level" });
  }
  if (primaryAverage !== null && primaryAverage < LOW_PRIMARY_SKILL_AVERAGE) {
    weaknesses.push({ type: "low_primary_skills" });
  }
  if (
    !input.profile ||
    input.profileCoherenceScore === null ||
    input.profileCoherenceScore < UNCLEAR_PROFILE_COHERENCE_THRESHOLD
  ) {
    weaknesses.push({ type: "unclear_profile" });
  }
  if (
    input.developmentPotentialScore !== null &&
    input.developmentPotentialScore <= LIMITED_POTENTIAL_THRESHOLD
  ) {
    weaknesses.push({ type: "limited_development_potential" });
  }
  if (
    input.profileCoherenceScore !== null &&
    input.profileCoherenceScore < UNCLEAR_PROFILE_COHERENCE_THRESHOLD
  ) {
    weaknesses.push({ type: "unbalanced_skill_distribution" });
  }
  return weaknesses;
}

function average(skills: Array<{ level: number }>): number | null {
  return skills.length === 0
    ? null
    : skills.reduce((total, skill) => total + skill.level, 0) / skills.length;
}

function countTrainingObservations(trainingHistory?: readonly TrainingHistory[]): number {
  return trainingHistory?.reduce((total, history) => total + history.weeks.length, 0) ?? 0;
}

function compareYouthProspectAssessments(
  left: YouthProspectAssessment,
  right: YouthProspectAssessment
): number {
  if (left.prospectScore === null && right.prospectScore !== null) return 1;
  if (left.prospectScore !== null && right.prospectScore === null) return -1;
  return (right.prospectScore ?? -1) - (left.prospectScore ?? -1) || left.playerId - right.playerId;
}

function isAssessment(
  value: YouthProspectContext | YouthProspectAssessment
): value is YouthProspectAssessment {
  return "prospectScore" in value && "confidence" in value && !("player" in value);
}

function roundScore(value: number): number {
  return Number.isFinite(value) ? Number(clamp(value, 0, 1).toFixed(4)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
