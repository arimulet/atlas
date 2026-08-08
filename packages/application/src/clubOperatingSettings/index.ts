import {
  MongoClubRepository,
  type PersistedClub,
  type PersistedClubManualRecord
} from "@atlas/database";
import {
  ClubOperatingSettings,
  OperatingPreferenceKey,
  OperatingPreferenceValue,
  UpdateClubOperatingSettingsInput,
  ValidatedManualOperatingSettingsUpdate
} from "./types";
import { ClubId } from "@atlas/application";
import { validateCurrency, validateSeason, validateWeek } from "@atlas/utils";

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

  const manual = validateManualOperatingSettings(input.manual);
  const nextPreferences =
    input.manual.preferences === undefined
      ? undefined
      : mergeOperatingPreferenceRecords(club.manual.preferences, manual.preferences ?? {});
  const update = {
    clubId: input.clubId,
    ...(input.manual.currency !== undefined ? { currency: manual.currency } : {}),
    ...(input.manual.season !== undefined ? { season: manual.season } : {}),
    ...(input.manual.week !== undefined ? { week: manual.week } : {}),
    ...(nextPreferences !== undefined ? { preferences: nextPreferences } : {})
  };

  const updated = await clubRepository.updateManualProfile(update);

  return buildClubOperatingSettings(updated);
};

export function buildClubOperatingSettings(club: PersistedClub): ClubOperatingSettings {
  const manualPreferences = readOperatingPreferences(club.manual.preferences);

  return {
    clubId: club.id,
    observed: {
      season: club.observed.season,
      week: club.observed.week
    },
    manual: {
      currency: club.manual.currency,
      season: club.manual.season,
      week: club.manual.week,
      preferences: manualPreferences
    },
    effective: {
      currency: club.manual.currency,
      season: club.manual.season ?? club.observed.season,
      week: club.manual.week ?? club.observed.week,
      preferences: {
        ...operatingPreferenceDefaults,
        ...manualPreferences
      }
    }
  };
}

function validateManualOperatingSettings(
  manual: UpdateClubOperatingSettingsInput["manual"]
): ValidatedManualOperatingSettingsUpdate {
  const validated: ValidatedManualOperatingSettingsUpdate = {};

  if ("currency" in manual) validated.currency = validateCurrency(manual.currency);
  if ("season" in manual) validated.season = validateSeason(manual.season);
  if ("week" in manual) validated.week = validateWeek(manual.week);
  if (manual.preferences) validated.preferences = validateOperatingPreferences(manual.preferences);

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

      if (!options.includes(value as never)) {
        throw new Error(`Invalid value for operating preference ${key}.`);
      }

      return [key, value];
    })
  ) as Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue | null>>;
}

function readOperatingPreferences(
  preferences: PersistedClubManualRecord[]
): Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>> {
  const result: Partial<Record<OperatingPreferenceKey, OperatingPreferenceValue>> = {};

  for (const preference of preferences) {
    if (!isOperatingPreferenceKey(preference.key)) {
      continue;
    }

    const value = preference.value;

    if (preferenceOptions[preference.key].includes(value as never)) {
      result[preference.key] = value as OperatingPreferenceValue;
    }
  }

  return result;
}

function mergeOperatingPreferenceRecords(
  existing: PersistedClubManualRecord[],
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
