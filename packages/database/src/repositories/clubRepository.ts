import { Types } from "mongoose";
import { ClubModel } from "../models/club.js";
import type { PersistedClub } from "./types.js";

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
  season?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  sourceType?: string | null;
  observedAt?: Date | null;
}

export interface UpdateClubManualProfileInput {
  clubId: ClubId;
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  assumptions?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string }>;
}

export class MongoClubRepository {
  async save(input: SaveClubInput): Promise<PersistedClub> {
    const $set: Record<string, unknown> = {
      name: input.name,
      country: input.country,
      season: input.season ?? null,
      week: input.week ?? null,
      lastSnapshotDate: input.lastSnapshotDate ?? null,
      sourceType: input.sourceType ?? null,
      observedAt: input.observedAt ?? null
    };

    if (input.training !== undefined) {
      $set.training = input.training;
    }

    if (!input.clubId) {
      const club = await ClubModel.create({
        clubId: input.clubId,
        ...$set
      });
      return mapClub(club.toObject());
    }

    const club = await ClubModel.findOneAndUpdate(
      { clubId: input.clubId },
      {
        $set,
        $setOnInsert: { clubId: input.clubId }
      },
      { new: true, upsert: true }
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

    if ("currency" in input) $set["settings.currency"] = normalizeOptionalString(input.currency);
    if ("season" in input) $set["settings.season"] = input.season ?? null;
    if ("week" in input) $set["settings.week"] = input.week ?? null;
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
  season?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  sourceType?: string | null;
  observedAt?: Date | null;
  settings?: {
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    assumptions?: Array<{ key: string; value: string; updatedAt: Date }>;
    preferences?: Array<{ key: string; value: string; updatedAt: Date }>;
  } | null;
}): PersistedClub {
  return {
    id: club._id.toString(),
    clubId: club.clubId ?? 0,
    country: club.country ?? 0,
    name: club.name,
    training: club.training
      ? {
          GK: club.training.GK ?? null,
          DEF: club.training.DEF ?? null,
          MID: club.training.MID ?? null,
          ATT: club.training.ATT ?? null
        }
      : null,
    season: club.season ?? null,
    week: club.week ?? null,
    lastSnapshotDate: club.lastSnapshotDate ?? null,
    sourceType: club.sourceType ?? null,
    observedAt: club.observedAt ?? null,
    settings: {
      currency: club.settings?.currency ?? null,
      season: club.settings?.season ?? null,
      week: club.settings?.week ?? null,
      assumptions: club.settings?.assumptions ?? [],
      preferences: club.settings?.preferences ?? []
    }
  };
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
