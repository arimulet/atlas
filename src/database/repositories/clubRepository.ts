import { Types, type ClientSession } from "mongoose";
import { ClubModel } from "../models/club.js";
import type { PersistedClub, PersistedClubStaffMember, SaveClubInput } from "./types.js";
import type { StadiumData, StandLocation, StandType } from "@atlas/domain";

export type ClubId = string | number;

export interface UpdateClubManualProfileInput {
  clubId: ClubId;
  week?: number | null;
  assumptions?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string }>;
}

interface PersistedArenaRaw {
  name: string;
  seats: number;
  seatsInProgress?: number | null;
  weather?: number | null;
  pitch: {
    length: number;
    width: number;
    mow: number;
    condition: number;
    grassType?: number | null;
    maintenance?: number | null;
    logo?: {
      size?: number | null;
      x?: number | null;
      y?: number | null;
    } | null;
  };
  stands: Array<{
    location: number;
    type: number;
    size: number;
    roof: boolean;
    ticketPrice?: {
      currency?: string | null;
      value?: number | null;
    } | null;
    inConstruction?: boolean | null;
    constructionDays?: number | null;
  }>;
}

export class MongoClubRepository {
  async save(input: SaveClubInput, session?: ClientSession): Promise<PersistedClub> {
    const $set: Record<string, unknown> = {
      name: input.name,
      country: input.country,
      currency: input.currency,
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

    $set.training = input.training;

    if (input.staff !== undefined) {
      $set.staff = input.staff;
    }

    if (input.ownerUserId !== undefined) {
      $set.ownerUserId = input.ownerUserId;
    }

    if (input.sokkerUsername !== undefined) {
      $set.sokkerUsername = input.sokkerUsername;
    }

    if (input.arena !== undefined) {
      $set.arena = input.arena;
    }

    const $setOnInsert: Record<string, unknown> = { clubId: input.clubId };

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
    if (Types.ObjectId.isValid(id)) {
      const club = await ClubModel.findById(id).lean();
      if (club) return mapClub(club);
    }
    const num = Number(id);
    if (Number.isFinite(num)) {
      const club = await ClubModel.findOne({ clubId: num }).lean();
      if (club) return mapClub(club);
    }
    return null;
  }

  async findByClubId(clubId: number): Promise<PersistedClub | null> {
    const club = await ClubModel.findOne({ clubId }).lean();
    return club ? mapClub(club) : null;
  }

  async findClubsByOwnerUserId(ownerUserId: string): Promise<PersistedClub[]> {
    const clubs = await ClubModel.find({ ownerUserId }).lean();
    return clubs.map((c) => mapClub(c));
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
  ownerUserId?: string | null;
  sokkerUsername?: string | null;
  country?: number | null;
  training?: {
    GK?: number;
    DEF?: number;
    MID?: number;
    ATT?: number;
  } | null;
  name: string;
  gameWeek?: number | null;
  week?: number | null;
  lastSnapshotDate?: Date | null;
  observedAt?: Date | null;
  currency?: string;
  staff?: PersistedClubStaffMember[];
  settings?: {
    week?: number | null;
    assumptions?: Array<{ key: string; value: string; updatedAt: Date }>;
    preferences?: Array<{ key: string; value: string; updatedAt: Date }>;
  } | null;
  budget?: number | null;
  arena?: PersistedArenaRaw | null;
}): PersistedClub {
  return {
    id: club._id.toString(),
    clubId: club.clubId ?? 0,
    ownerUserId: club.ownerUserId ?? null,
    sokkerUsername: club.sokkerUsername ?? null,
    country: club.country ?? 0,
    name: club.name,
    currency: club.currency ?? "UNK",
    budget: club.budget ?? null,
    staff: club.staff ?? [],
    arena: club.arena ? mapPersistedArena(club.arena) : null,
    training: requireNumericTraining(club.training),
    gameWeek: club.gameWeek ?? null,
    week: club.week ?? null,
    lastSnapshotDate: club.lastSnapshotDate ?? null,
    observedAt: club.observedAt ?? null,
    settings: {
      week: club.settings?.week ?? null,
      assumptions: club.settings?.assumptions ?? [],
      preferences: club.settings?.preferences ?? []
    }
  };
}

function requireNumericTraining(
  training: {
    GK?: number;
    DEF?: number;
    MID?: number;
    ATT?: number;
  } | null | undefined
): PersistedClub["training"] {
  const GK = training?.GK;
  const DEF = training?.DEF;
  const MID = training?.MID;
  const ATT = training?.ATT;

  if (
    training === null ||
    training === undefined ||
    typeof GK !== "number" ||
    !Number.isFinite(GK) ||
    typeof DEF !== "number" ||
    !Number.isFinite(DEF) ||
    typeof MID !== "number" ||
    !Number.isFinite(MID) ||
    typeof ATT !== "number" ||
    !Number.isFinite(ATT)
  ) {
    throw new Error("Club training configuration is missing numeric values for every position.");
  }

  return {
    GK,
    DEF,
    MID,
    ATT
  };
}

function mapPersistedArena(arena: PersistedArenaRaw): StadiumData {
  return {
    name: arena.name,
    seats: arena.seats,
    seatsInProgress: arena.seatsInProgress ?? 0,
    weather: arena.weather ?? undefined,
    pitch: {
      length: arena.pitch.length,
      width: arena.pitch.width,
      mow: arena.pitch.mow,
      condition: arena.pitch.condition,
      grassType: arena.pitch.grassType ?? undefined,
      maintenance: arena.pitch.maintenance ?? undefined,
      logo: arena.pitch.logo
        ? {
            size: arena.pitch.logo.size ?? 0,
            x: arena.pitch.logo.x ?? 0,
            y: arena.pitch.logo.y ?? 0
          }
        : undefined
    },
    stands: Array.isArray(arena.stands)
      ? arena.stands.map((s) => ({
          location: s.location as StandLocation,
          type: s.type as StandType,
          size: s.size,
          roof: s.roof,
          ticketPrice: s.ticketPrice
            ? {
                currency: s.ticketPrice.currency ?? "",
                value: s.ticketPrice.value ?? 0
              }
            : undefined,
          inConstruction: s.inConstruction ?? false,
          constructionDays: s.constructionDays ?? 0
        }))
      : []
  };
}
