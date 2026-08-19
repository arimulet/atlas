import { Types, type ClientSession } from "mongoose";
import { ClubModel } from "../models/club.js";
import type { PersistedClub, PersistedClubStaffMember } from "./types.js";

export type ClubId = string | number;

export interface SaveClubInput {
  clubId: number;
  country: number;
  training?: {
    GK: number | null;
    DEF: number | null;
    MID: number | null;
    ATT: number | null;
  } | null;
  name: string;
  gameWeek?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  observedAt?: Date | null;
  currency: { name: string; rate: number };
  budget?: { value: number } | null;
  staff?: PersistedClubStaffMember[];
}

export interface UpdateClubManualProfileInput {
  clubId: ClubId;
  currency?: { name: string; rate: number };
  week?: number | null;
  assumptions?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string }>;
}

export class MongoClubRepository {
  async save(input: SaveClubInput, session?: ClientSession): Promise<PersistedClub> {
    const $set: Record<string, unknown> = {
      name: input.name,
      country: input.country,
      week: input.week ?? null,
      lastSnapshotDate: input.lastSnapshotDate ?? null,
      observedAt: input.observedAt ?? null
    };

    if (input.budget !== undefined) {
      $set.budget = input.budget;
    }

    if (input.gameWeek !== undefined) {
      $set.gameWeek = input.gameWeek;
    }

    if (input.training !== undefined) {
      $set.training = input.training;
    }

    if (input.staff !== undefined) {
      $set.staff = input.staff;
    }

    const $setOnInsert: Record<string, unknown> = {
      clubId: input.clubId,
      "settings.currency": { name: input.currency.name, rate: input.currency.rate }
    };

    const club = await ClubModel.findOneAndUpdate(
      { clubId: input.clubId },
      {
        $set,
        $setOnInsert
      },
      { new: true, upsert: true, session }
    );

    return mapClub(club.toObject());
  }

  async findById(id: string): Promise<PersistedClub | null> {
    const club = await ClubModel.findById(id);
    return club ? mapClub(club.toObject()) : null;
  }

  async updateManualProfile(input: UpdateClubManualProfileInput): Promise<PersistedClub> {
    const updatedAt = new Date();
    const $set: Record<string, unknown> = {};

    if (input.week !== undefined) $set["settings.week"] = input.week ?? null;
    if (input.assumptions) {
      $set["settings.assumptions"] = input.assumptions.map((record) => ({ ...record, updatedAt }));
    }
    if (input.preferences) {
      $set["settings.preferences"] = input.preferences.map((record) => ({ ...record, updatedAt }));
    }

    if (Object.keys($set).length === 0) {
      const club = await this.findById(input.clubId.toString());

      if (!club) {
        throw new Error(`Club not found: ${input.clubId}`);
      }

      return club;
    }

    const club = await ClubModel.findByIdAndUpdate(input.clubId, { $set }, { new: true });

    if (!club) {
      throw new Error(`Club not found: ${input.clubId}`);
    }

    return mapClub(club.toObject());
  }
}

function mapClub(club: {
  _id: Types.ObjectId;
  clubId?: number | null;
  country?: number | null;
  training?: {
    GK?: number | null;
    DEF?: number | null;
    MID?: number | null;
    ATT?: number | null;
  } | null;
  name: string;
  gameWeek?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  observedAt?: Date | null;
  staff?: PersistedClubStaffMember[];
  settings?: {
    currency?: { name: string; rate: number };
    week?: number | null;
    assumptions?: Array<{ key: string; value: string; updatedAt: Date }>;
    preferences?: Array<{ key: string; value: string; updatedAt: Date }>;
  } | null;
  budget?: { value?: number | null } | null;
}): PersistedClub {
  const currency = club.settings?.currency ?? { name: "UNK", rate: 1 };

  return {
    id: club._id.toString(),
    clubId: club.clubId ?? 0,
    country: club.country ?? 0,
    name: club.name,
    budget: club.budget ? { value: club.budget.value ?? null, currency: currency.name } : null,
    staff: club.staff ?? [],
    training: club.training
      ? {
          GK: club.training.GK ?? null,
          DEF: club.training.DEF ?? null,
          MID: club.training.MID ?? null,
          ATT: club.training.ATT ?? null
        }
      : null,
    gameWeek: club.gameWeek ?? null,
    week: club.week ?? null,
    lastSnapshotDate: club.lastSnapshotDate ?? null,
    observedAt: club.observedAt ?? null,
    settings: {
      currency,
      week: club.settings?.week ?? null,
      assumptions: club.settings?.assumptions ?? [],
      preferences: club.settings?.preferences ?? []
    }
  };
}
