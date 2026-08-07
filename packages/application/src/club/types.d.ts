import { type PersistedClub } from "@atlas/database";
import { type ClubOperatingSettings } from "../clubOperatingSettings/types.js";
import {
  type MarketPlanningCategory,
  type MarketPlanningConfidence,
  type MarketPlanningSeverity
} from "../marketPlanning/types.js";
import {
  type YouthPipelineCategory,
  type YouthPipelineConfidence,
  type YouthPipelineSeverity
} from "../playerDevelopment/types.js";

export interface GetClubDashboardInput {
  clubId: string;
}

export interface GetClubProfileInput {
  clubId: string;
}

export interface UpdateClubProfileInput {
  clubId: string;
  manual: {
    name?: string | null;
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    assumptions?: Array<{ key: string; value: string }>;
    preferences?: Array<{ key: string; value: string }>;
  };
}

export interface ValidatedManualProfileUpdate {
  name?: string | null;
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  assumptions?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string }>;
}

export interface ClubDashboard {
  club: PersistedClub;
  settings: ClubOperatingSettings;
  snapshots: {
    available: boolean;
    count: number;
    latest: ClubDashboardSnapshotSummary | null;
    previous: ClubDashboardSnapshotSummary | null;
    canCompare: boolean;
  };
  developmentSummary: ClubDashboardDevelopmentSummary;
  marketSummary: ClubDashboardMarketSummary;
  youthPipelineSummary: ClubDashboardYouthPipelineSummary;
  operationalAreas: Array<{
    key:
      | "diagnostic"
      | "history"
      | "findings"
      | "squad-economy"
      | "player-development"
      | "squad-market-planning"
      | "youth-pipeline-planning"
      | "training"
      | "academy"
      | "market";
    label: string;
    status: "available" | "ready" | "planned";
    summary: string;
  }>;
}

export interface ClubDashboardSnapshotSummary {
  id: string;
  clubId: string;
  snapshotDate: string;
  importedAt: string;
  season: number | null;
  week: number | null;
  playerCount: number;
}

export interface ClubDashboardDevelopmentSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
  };
  manual: {
    trainingPriority: string;
  };
  derived: {
    improvingPlayers: number;
    stagnatedPlayers: number;
    decliningPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardDevelopmentPlayer[];
  };
}

export interface ClubDashboardDevelopmentPlayer {
  playerId: string | null;
  name: string;
  signal: "improvement" | "stagnation" | "decline" | "insufficient_data";
  severity: "info" | "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
}

export interface ClubDashboardMarketSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    playerCount: number;
    playersWithStableIdentity: number;
  };
  manual: {
    marketStrategy: string;
  };
  derived: {
    saleCandidates: number;
    protectionCandidates: number;
    followUpPlayers: number;
    insufficientSignalPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardMarketPlayer[];
  };
}

export interface ClubDashboardMarketPlayer {
  playerId: string | null;
  name: string;
  signal: MarketPlanningCategory;
  severity: MarketPlanningSeverity;
  confidence: MarketPlanningConfidence;
  timing: string;
}

export interface ClubDashboardYouthPipelineSummary {
  available: boolean;
  detailPath: string;
  observed: {
    snapshotCount: number;
    latestSnapshotDate: string | null;
    seniorPlayerCount: number;
    youngSeniorPlayerCount: number;
    youthAgeThreshold: number;
  };
  manual: {
    academyInvestment: string;
  };
  derived: {
    standoutProspects: number;
    followUpPlayers: number;
    stagnationRiskPlayers: number;
    insufficientDataPlayers: number;
  };
  inferred: {
    headline: string;
    warning: string | null;
    highlightedPlayers: ClubDashboardYouthPipelinePlayer[];
  };
}

export interface ClubDashboardYouthPipelinePlayer {
  playerId: string | null;
  name: string;
  signal: YouthPipelineCategory;
  severity: YouthPipelineSeverity;
  confidence: YouthPipelineConfidence;
}

export interface CompareClubSnapshotsInput {
  clubId: string;
  baseSnapshotId?: string;
  targetSnapshotId?: string;
  baseSnapshotDate?: string;
  targetSnapshotDate?: string;
}