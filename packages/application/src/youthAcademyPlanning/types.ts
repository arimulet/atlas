import { ClubId, Confidence, EvidenceKind, Money, Severity } from "@atlas/application";

export type YouthAcademyCategory =
  | "standout_prospect"
  | "ready_for_promotion"
  | "follow_up"
  | "stagnation_risk"
  | "insufficient_data";

export interface RealYouthAcademyPlanning {
  clubId: ClubId;
  snapshotId: string | null;
  snapshotDate: string | null;
  observed: {
    players: YouthAcademyObservedPlayer[];
    coverage: {
      totalYouthCount: number;
      youthsWithWeeksRemaining: number;
      youthsWithSkill: number;
    };
    weeklyInvestment: Money | null;
  };
  manual: {
    academyInvestment: string;
  };
  derived: {
    categoryCounts: Record<YouthAcademyCategory, number>;
    players: RealYouthAcademyPlayerPlan[];
  };
  warnings: YouthAcademyWarning[];
}

export interface YouthAcademyObservedPlayer {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialWeeksRemaining: number | null;
  weeksRemaining: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
}

export interface RealYouthAcademyPlayerPlan {
  id: string;
  playerId: number;
  name: string;
  age: number;
  initialWeeksRemaining: number | null;
  weeksRemaining: number | null;
  weeksInAcademy: number | null;
  projectedPromotionAge: number | null;
  skill: number | null;
  status: "in_academy" | "ready_for_promotion" | "promoted";
  category: YouthAcademyCategory;
  severity: Severity;
  confidence: Confidence;
  rationale: string;
  signals: YouthAcademySignal[];
  warnings: YouthAcademyWarning[];
}

export interface YouthAcademySignal {
  code: string;
  severity: Severity;
  confidence: Confidence;
  message: string;
  evidence: YouthAcademyEvidence[];
}

export interface YouthAcademyWarning {
  code: string;
  message: string;
  evidence: YouthAcademyEvidence[];
}

export interface YouthAcademyEvidence {
  kind: EvidenceKind;
  label: string;
  value?: string | number;
}
