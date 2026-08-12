import { ClubId } from "../types.js";

export type OperatingPreferenceKey = "academy.investment" | "economy.riskTolerance" | "market.strategy" | "training.priority";
export type OperatingPreferenceValue = "aggressive" | "ambitious" | "balanced" | "conservative" | "development" | "minimal" | "opportunistic" | "performance";

export interface ClubOperatingSettings {
  clubId: string;
  observed: {
    week: number | null;
  };
  settings: {
    currency: { name: string; rate: number };
    week: number | null;
    preferences: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>>;
  };
  effective: {
    currency: { name: string; rate: number };
    week: number | null;
    preferences: Record<OperatingPreferenceKey, OperatingPreferenceValue>;
  };
}

export interface UpdateClubOperatingSettingsInput {
  clubId: ClubId;
  settings: {
    currency?: { name: string; rate: number };
    week?: number | null;
    preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
  };
}

export interface ValidatedManualOperatingSettingsUpdate {
  currency?: { name: string; rate: number };
  week?: number | null;
  preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}
