import { KeyValue } from "../types";

export type OperatingPreferenceKey = "academy.investment" | "economy.riskTolerance" | "market.strategy" | "training.priority" // keyof typeof operatingPreferenceDefaults;
export type OperatingPreferenceValue = "aggressive" | "ambitious" | "balanced" | "conservative" | "development" | "minimal" | "opportunistic" | "performance" // (typeof preferenceOptions)[OperatingPreferenceKey][number];

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

export interface GetClubOperatingSettingsInput {
  clubId: string;
}

export interface UpdateClubOperatingSettingsInput {
  clubId: string;
  manual: {
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
  };
}

export interface ValidatedManualProfileUpdate {
  name?: string | null;
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  assumptions?: KeyValue[];
  preferences?: KeyValue[];
}

interface ValidatedManualOperatingSettingsUpdate {
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  preferences?: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}