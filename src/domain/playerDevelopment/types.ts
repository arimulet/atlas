import type { ObservedPosition, SkillKey } from "../types.js";

export type DevelopmentSkill = SkillKey;

export type Formation = "GK" | "DEF" | "MID" | "ATT";

export type DevelopmentProfile =
  "goalkeeper" | "defender" | "wing_defender" | "midfielder" | "winger" | "forward";

export type DevelopmentPriority = "primary" | "secondary" | "supporting";

export type DevelopmentTargetSource = "automatic" | "manual";

export interface DevelopmentPlayer {
  playerId: number;
  skills: Partial<Record<DevelopmentSkill, number | null>>;
  age?: number | null;
  formation?: Formation | null;
  position?: Formation | null;
  observedPosition?: ObservedPosition | null;
}

export type DevelopmentTargetReason =
  | { type: "primary_skill" }
  | { type: "within_development_horizon"; age: number }
  | { type: "positive_marginal_return"; score: number }
  | { type: "manual_override" };

export interface DevelopmentTargetSkill {
  skill: DevelopmentSkill;
  targetLevel: number;
  priority: DevelopmentPriority;
  reasons?: DevelopmentTargetReason[];
}

export interface PlayerDevelopmentTarget {
  playerId: number;
  profile: DevelopmentProfile;
  targetSkills: DevelopmentTargetSkill[];
  source: DevelopmentTargetSource;
}


export interface DevelopmentProfileDefinition {
  id: DevelopmentProfile;
  relevantSkills: Array<{
    skill: DevelopmentSkill;
    priority: DevelopmentPriority;
    defaultTargetLevel: number;
  }>;
}

export type DevelopmentProfileReason =
  | {
      type: "formation_match";
      formation: Formation;
    }
  | {
      type: "strong_skill";
      skill: DevelopmentSkill;
      level: number;
    }
  | {
      type: "profile_skill_distribution";
      profile: DevelopmentProfile;
    }
  | {
      type: "profile_better_than_current_formation";
      currentFormation: Formation;
      suggestedProfile: DevelopmentProfile;
    }
  | {
      type: "manual_override";
      profile: DevelopmentProfile;
    };

export interface DevelopmentProfileEvaluation {
  profile: DevelopmentProfile;
  score: number;
  reasons: DevelopmentProfileReason[];
}

export interface DevelopmentProfileSuggestion {
  profile: DevelopmentProfile;
  confidence: "low" | "medium" | "high";
  reasons: DevelopmentProfileReason[];
}

export interface DevelopmentSkillGap {
  skill: DevelopmentSkill;
  currentLevel: number;
  targetLevel: number;
  levelsRemaining: number;
  priority: DevelopmentPriority;
  completed: boolean;
}

export interface PlayerDevelopmentGap {
  playerId: number;
  profile: DevelopmentProfile;
  skills: DevelopmentSkillGap[];
  totalGap: number;
  progress: number;
}

export interface PlayerDevelopmentTargetOverride {
  profile?: DevelopmentProfile | null;
  targetLevels?: Partial<Record<DevelopmentSkill, number>>;
}

