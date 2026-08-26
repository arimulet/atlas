import type {
  AdvancedTrainingOptimization,
  CalibratedPlayerMarketValueEstimate,
  DevelopmentProfile,
  PlayerDevelopmentPlan,
  PlayerDevelopmentProjection,
  PlayerMarketValueProjection,
  PlayerTrainingPath,
  SquadRole,
  YouthDecisionRecommendation,
  YouthDecisionSummary,
  YouthDevelopmentOpportunity,
  YouthProspectAssessment
} from "@atlas/domain";

export interface YouthDecisionCandidate {
  playerId: number;
  playerName: string;
  age: number | null;
  role: SquadRole;
  formation: "GK" | "DEF" | "MID" | "ATT" | null;
  initialProfile: DevelopmentProfile | null;
  prospect: YouthProspectAssessment;
  opportunity: YouthDevelopmentOpportunity;
  recommendation: YouthDecisionRecommendation;
  developmentPlan: PlayerDevelopmentPlan | null;
  trainingPath: PlayerTrainingPath | null;
  developmentProjection: PlayerDevelopmentProjection | null;
  marketValue: CalibratedPlayerMarketValueEstimate | null;
  marketProjection: PlayerMarketValueProjection | null;
}

export interface YouthDecisionPlanning {
  clubId: string;
  candidates: YouthDecisionCandidate[];
  summary: YouthDecisionSummary;
  advancedTraining: AdvancedTrainingOptimization | null;
}
