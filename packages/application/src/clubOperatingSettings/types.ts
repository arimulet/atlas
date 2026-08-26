import { ClubId } from "../types.js";

export type OperatingPreferenceKey = "academy.investment" | "economy.riskTolerance" | "market.strategy" | "training.priority";
export type OperatingPreferenceValue = "aggressive" | "ambitious" | "balanced" | "conservative" | "development" | "minimal" | "opportunistic" | "performance";

export interface ClubOperatingSettings {
  clubId: string;
  observed: {
    week: number | null;
  };
  settings: {
    week: number | null;
    preferences: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>>;
  };
  effective: {
    week: number | null;
    preferences: Record<OperatingPreferenceKey, OperatingPreferenceValue>;
  };
}

export interface UpdateClubOperatingSettingsInput {
  clubId: ClubId;
  settings: {
    week?: number | null;
    preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
  };
}

export interface ValidatedManualOperatingSettingsUpdate {
  week?: number | null;
  preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}
