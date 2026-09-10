import type { Confidence, SkillKey } from "../types.js";
import type { TrainingHistory, TalentEstimate } from "../training/types.js";
import type {
  DevelopmentPlayer,
  DevelopmentProfile,
  DevelopmentProfileSuggestion,
  PlayerDevelopmentTarget
} from "../playerDevelopment/types.js";

export type YouthProspectPlayer = DevelopmentPlayer;

export interface YouthProspectContext {
  player: YouthProspectPlayer;
  talent?: TalentEstimate | null;
  trainingHistory?: readonly TrainingHistory[];
  suggestedDevelopmentProfile?: DevelopmentProfileSuggestion | null;
  includeSuggestedDevelopmentTarget?: boolean;
}

export type YouthProspectStrength =
  | { type: "young_for_skill_level" }
  | { type: "strong_primary_skill"; skill: SkillKey; level: number }
  | { type: "balanced_profile" }
  | { type: "high_development_potential" }
  | { type: "clear_profile_fit"; profile: DevelopmentProfile };

export type YouthProspectWeakness =
  | { type: "older_for_skill_level" }
  | { type: "low_primary_skills" }
  | { type: "unclear_profile" }
  | { type: "limited_development_potential" }
  | { type: "unbalanced_skill_distribution" };

export type YouthProspectReason =
  | { type: "profile_detected"; profile: DevelopmentProfile; confidence: Confidence }
  | { type: "profile_not_inferable" }
  | { type: "age_adjustment"; relativeTrainingSpeed: number | null }
  | { type: "strong_primary_skill"; skill: SkillKey; level: number }
  | { type: "profile_coherence"; score: number }
  | { type: "talent_evidence"; confidence: "low" | "medium" | "high"; value: number }
  | { type: "training_evidence"; observationCount: number }
  | { type: "incomplete_skills"; missingSkills: SkillKey[] }
  | { type: "invalid_age" }
  | { type: "automatic_development_target"; profile: DevelopmentProfile };

export interface YouthProspectAssessment {
  playerId: number;
  suggestedProfile: DevelopmentProfile | null;
  profileCoherenceScore: number | null;
  currentQualityScore: number | null;
  developmentPotentialScore: number | null;
  prospectScore: number | null;
  confidence: Confidence;
  strengths: YouthProspectStrength[];
  weaknesses: YouthProspectWeakness[];
  reasons: YouthProspectReason[];
  suggestedDevelopmentTarget: PlayerDevelopmentTarget | null;
}

export interface YouthProspectDiagnostic {
  playerId: number;
  age: number | null;
  profile: DevelopmentProfile | null;
  currentQualityScore: number | null;
  developmentPotentialScore: number | null;
  profileCoherenceScore: number | null;
  prospectScore: number | null;
  confidence: Confidence;
}
