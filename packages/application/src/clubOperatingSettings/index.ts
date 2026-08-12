import {
  MongoClubRepository,
  type PersistedClub,
  type PersistedClubSettingsRecord
} from "@atlas/database";
import {
  ClubOperatingSettings,
  OperatingPreferenceKey,
  OperatingPreferenceValue,
  UpdateClubOperatingSettingsInput,
  ValidatedManualOperatingSettingsUpdate
} from "./types";
import { ClubId } from "@atlas/application";
import { validateCurrency, validateWeek } from "@atlas/utils";

const operatingPreferenceDefaults: Record<OperatingPreferenceKey, OperatingPreferenceValue> = {
  "economy.riskTolerance": "balanced",
  "training.priority": "balanced",
  "academy.investment": "balanced",
  "market.strategy": "balanced"
};

const preferenceOptions: Record<OperatingPreferenceKey, OperatingPreferenceValue[]> = {
  "economy.riskTolerance": ["conservative", "balanced", "aggressive"],
  "training.priority": ["performance", "balanced", "development"],
  "academy.investment": ["minimal", "balanced", "ambitious"],
  "market.strategy": ["conservative", "balanced", "opportunistic"]
};

const clubRepository = new MongoClubRepository();

export const getClubOperatingSettings = async (clubId: ClubId): Promise<ClubOperatingSettings> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  return buildClubOperatingSettings(club);
};

export const updateClubOperatingSettings = async (
  input: UpdateClubOperatingSettingsInput
): Promise<ClubOperatingSettings> => {
  const club = await clubRepository.findById(input.clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  const settings = validatesettingsOperatingSettings(input.settings);
  const nextPreferences =
    input.settings.preferences === undefined
      ? undefined
      : mergeOperatingPreferenceRecords(club.settings.preferences, settings.preferences ?? {});
  const update = {
    clubId: input.clubId,
    ...(input.settings.currency !== undefined ? { currency: settings.currency } : {}),
    ...(input.settings.week !== undefined ? { week: settings.week } : {}),
    ...(nextPreferences !== undefined ? { preferences: nextPreferences } : {})
  };

  const updated = await clubRepository.updateManualProfile(update);

  return buildClubOperatingSettings(updated);
};

export function buildClubOperatingSettings(club: PersistedClub): ClubOperatingSettings {
  const settingsPreferences = readOperatingPreferences(club.settings.preferences);

  return {
    clubId: club.id,
    observed: {
      week: club.week
    },
    settings: {
      currency: club.settings.currency,
      week: club.settings.week ?? null,
      preferences: settingsPreferences
    },
    effective: {
      currency: club.settings.currency,
      week: club.settings.week ?? club.week,
      preferences: {
        ...operatingPreferenceDefaults,
        ...settingsPreferences
      }
    }
  };
}

function validatesettingsOperatingSettings(
  settings: UpdateClubOperatingSettingsInput["settings"]
): ValidatedManualOperatingSettingsUpdate {
  const validated: ValidatedManualOperatingSettingsUpdate = {};

  if ("currency" in settings) validated.currency = validateCurrency(settings.currency);
  if ("week" in settings) validated.week = validateWeek(settings.week);
  if (settings.preferences) validated.preferences = validateOperatingPreferences(settings.preferences);

  return validated;
}



function validateOperatingPreferences(
  preferences: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>
) {
  return Object.fromEntries(
    Object.entries(preferences).map(([key, value]) => {
      assertOperatingPreferenceKey(key);

      if (value === null) {
        return [key, null];
      }

      const options = preferenceOptions[key];

      if (!options.includes(value as OperatingPreferenceValue)) {
        throw new Error(`Invalid value for operating preference ${key}.`);
      }

      return [key, value];
    })
  ) as Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}

function readOperatingPreferences(
  preferences: PersistedClubSettingsRecord[]
): Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>> {
  const result: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>> = {};

  for (const preference of preferences) {
    if (!isOperatingPreferenceKey(preference.key)) {
      continue;
    }

    const value = preference.value;

    if (preferenceOptions[preference.key as OperatingPreferenceKey].includes(value as OperatingPreferenceValue)) {
      result[preference.key as OperatingPreferenceKey] = value as OperatingPreferenceValue;
    }
  }

  return result;
}

function mergeOperatingPreferenceRecords(
  existing: PersistedClubSettingsRecord[],
  updates: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>
) {
  const operatingKeys = new Set(Object.keys(operatingPreferenceDefaults));
  const records = existing
    .filter((record) => !operatingKeys.has(record.key))
    .map(({ key, value }) => ({ key, value }));
  const current = readOperatingPreferences(existing);
  const next = { ...current, ...updates };

  for (const key of Object.keys(operatingPreferenceDefaults) as OperatingPreferenceKey[]) {
    const value = next[key];

    if (value) {
      records.push({ key, value });
    }
  }

  return records;
}

function assertOperatingPreferenceKey(key: string): asserts key is OperatingPreferenceKey {
  if (!isOperatingPreferenceKey(key)) {
    throw new Error(`Unknown operating preference: ${key}.`);
  }
}

function isOperatingPreferenceKey(key: string): key is OperatingPreferenceKey {
  return key in operatingPreferenceDefaults;
}

export * from "./types.js";
