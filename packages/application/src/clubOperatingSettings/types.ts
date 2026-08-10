import { ClubId } from "../types.js";

export type OperatingPreferenceKey = "academy.investment" | "economy.riskTolerance" | "market.strategy" | "training.priority";
export type OperatingPreferenceValue = "aggressive" | "ambitious" | "balanced" | "conservative" | "development" | "minimal" | "opportunistic" | "performance";

export interface ClubOperatingSettings {
  clubId: string;
  observed: {
    season: number | null;
    week: number | null;
  };
  manual: {
    currency: string | null;
    season: number | null;
    week: number | null;
    preferences: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>>;
  };
  effective: {
    currency: string | null;
    season: number | null;
    week: number | null;
    preferences: Record<OperatingPreferenceKey, OperatingPreferenceValue>;
  };
}

export interface UpdateClubOperatingSettingsInput {
  clubId: ClubId;
  manual: {
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
  };
}

export interface ValidatedManualOperatingSettingsUpdate {
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}
