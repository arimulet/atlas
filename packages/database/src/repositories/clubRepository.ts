import { Types } from "mongoose";
import { ClubModel } from "../models/club.js";
import type { PersistedClub } from "./types.js";

export interface SaveClubInput {
  externalId: string | null;
  name: string;
  season?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  sourceType?: string | null;
  observedAt?: Date | null;
}

export interface UpdateClubManualProfileInput {
  clubId: string;
  name?: string | null;
  currency?: string | null;
  season?: number | null;
  week?: number | null;
  assumptions?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string }>;
}

export class MongoClubRepository {
  async save(input: SaveClubInput): Promise<PersistedClub> {
    const observed = {
      externalId: input.externalId,
      name: input.name,
      season: input.season ?? null,
      week: input.week ?? null,
      lastSnapshotDate: input.lastSnapshotDate ?? null,
      sourceType: input.sourceType ?? null,
      observedAt: input.observedAt ?? null
    };

    if (!input.externalId) {
      const club = await ClubModel.create({
        externalId: input.externalId,
        name: input.name,
        observed
      });
      return mapClub(club.toObject());
    }

    const club = await ClubModel.findOneAndUpdate(
      { externalId: input.externalId },
      {
        $set: {
          name: input.name,
          observed
        },
        $setOnInsert: { externalId: input.externalId }
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

    if ("name" in input) $set["manual.name"] = normalizeOptionalString(input.name);
    if ("currency" in input) $set["manual.currency"] = normalizeOptionalString(input.currency);
    if ("season" in input) $set["manual.season"] = input.season ?? null;
    if ("week" in input) $set["manual.week"] = input.week ?? null;
    if (input.assumptions) {
      $set["manual.assumptions"] = input.assumptions.map((record) => ({ ...record, updatedAt }));
    }
    if (input.preferences) {
      $set["manual.preferences"] = input.preferences.map((record) => ({ ...record, updatedAt }));
    }

    if (Object.keys($set).length === 0) {
      const club = await this.findById(input.clubId);

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
  externalId?: string | null;
  name: string;
  observed?: {
    externalId?: string | null;
    name?: string | null;
    season?: number | null;
    week?: number | null;
    lastSnapshotDate?: Date | null;
    sourceType?: string | null;
    observedAt?: Date | null;
  } | null;
  manual?: {
    name?: string | null;
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    assumptions?: Array<{ key: string; value: string; updatedAt: Date }>;
    preferences?: Array<{ key: string; value: string; updatedAt: Date }>;
  } | null;
}): PersistedClub {
  const observed = {
    externalId: club.observed?.externalId ?? club.externalId ?? null,
    name: club.observed?.name ?? club.name,
    season: club.observed?.season ?? null,
    week: club.observed?.week ?? null,
    lastSnapshotDate: club.observed?.lastSnapshotDate ?? null,
    sourceType: club.observed?.sourceType ?? null,
    observedAt: club.observed?.observedAt ?? null
  };
  const manual = {
    name: club.manual?.name ?? null,
    currency: club.manual?.currency ?? null,
    season: club.manual?.season ?? null,
    week: club.manual?.week ?? null,
    assumptions: club.manual?.assumptions ?? [],
    preferences: club.manual?.preferences ?? []
  };

  return {
    id: club._id.toString(),
    observed,
    manual,
    profile: {
      externalId: observed.externalId,
      name: manual.name ?? observed.name,
      currency: manual.currency,
      season: manual.season ?? observed.season,
      week: manual.week ?? observed.week
    },
    externalId: observed.externalId,
    name: manual.name ?? observed.name
  };
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
