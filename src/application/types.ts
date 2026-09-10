import { type SnapshotSkillSet } from "@atlas/database";

export type SkillKey = keyof SnapshotSkillSet;
export type Severity = "info" | "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type KeyValue = {
  key: string;
  value: string;
};
export type EvidenceKind = "observed" | "manual" | "derived" | "inferred";
export type DeltaDirection = "up" | "down" | "stable" | "insufficient_data";
export type FindingType = "improvement" | "stagnation" | "decline" | "insufficient_data";
export type RoleSource = "observed" | "inferred" | "unknown";
export type Category =  "standout_prospect" | "follow_up" | "stagnation_risk" | "insufficient_data";
export type Money = {
  amount: number;
  currency: string | null;
  isComplete?: boolean;
};
export type ClubId = string | number;