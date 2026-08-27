import { Types, type ClientSession } from "mongoose";
import { PlayerModel } from "../models/player.js";
import type {
  PersistedDevelopmentProfile,
  PersistedPlayer,
  PersistedPlayerDevelopmentOverride,
  SavePlayerDevelopmentOverrideInput
} from "./types.js";

export type PlayerPosition = "GK" | "DEF" | "MID" | "ATT" | null;

export interface ResolvePlayerIdentityInput {
  playerId: number;
  clubId: number;
  name: string;
  countryId?: number | null;
  countryName?: string | null;
  age?: number | null;
  position?: PlayerPosition;
  skills?: Record<string, number>;
  marketValue?: number | null;
  wage?: number | null;
  cards?: { yellow: number; red: number };
  injury?: { days: number; severe: boolean };
  currentGameWeek?: number | null;
}

export class MongoPlayerRepository {
  async resolveHistoricalIdentity(
    input: ResolvePlayerIdentityInput,
    session?: ClientSession
  ): Promise<PersistedPlayer> {
    const $set: Record<string, unknown> = { name: input.name };

    if (input.countryId !== undefined) $set.countryId = input.countryId;
    if (input.countryName !== undefined) $set.countryName = input.countryName;
    if (input.age !== undefined) $set.age = input.age;
    if (input.position !== undefined) $set.position = input.position;
    if (input.skills !== undefined) $set.skills = input.skills;
    if (input.marketValue !== undefined) $set.marketValue = input.marketValue;
    if (input.wage !== undefined) $set.wage = input.wage;
    if (input.cards !== undefined) $set.cards = input.cards;
    if (input.injury !== undefined) $set.injury = input.injury;
    if (input.currentGameWeek !== undefined) $set.currentGameWeek = input.currentGameWeek;

    const player = await PlayerModel.findOneAndUpdate(
      { clubId: input.clubId, playerId: input.playerId },
      {
        $set,
        $setOnInsert: { clubId: input.clubId, playerId: input.playerId }
      },
      { new: true, upsert: true, runValidators: true, session }
    );

    return mapPlayer(player.toObject());
  }

  async findByPlayerId(input: {
    playerId: number;
    clubId: number;
  }): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findOne({ playerId: input.playerId, clubId: input.clubId });
    return player ? mapPlayer(player.toObject()) : null;
  }

  async findById(id: string): Promise<PersistedPlayer | null> {
    const player = await PlayerModel.findById(id);
    return player ? mapPlayer(player.toObject()) : null;
  }

  async findDevelopmentOverride(input: {
    playerId: number;
    clubId: number;
  }): Promise<PersistedPlayerDevelopmentOverride | null> {
    const player = await this.findByPlayerId(input);
    if (!player?.development) return null;

    return {
      id: player.id,
      playerId: player.playerId,
      clubId: player.clubId,
      profile: player.development.profile,
      targetLevels: player.development.targetLevels
    };
  }

  async saveDevelopmentOverride(
    input: SavePlayerDevelopmentOverrideInput
  ): Promise<PersistedPlayerDevelopmentOverride> {
    const player = await PlayerModel.findOneAndUpdate(
      { playerId: input.playerId, clubId: input.clubId },
      {
        $set: {
          development: {
            profile: input.profile ?? null,
            targetLevels: input.targetLevels ?? {}
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!player) {
      throw new Error(`Player not found: ${input.clubId}/${input.playerId}`);
    }

    const mapped = mapPlayer(player.toObject());
    if (!mapped.development) {
      throw new Error(`Development override was not saved: ${input.clubId}/${input.playerId}`);
    }

    return {
      id: mapped.id,
      playerId: mapped.playerId,
      clubId: mapped.clubId,
      profile: mapped.development.profile,
      targetLevels: mapped.development.targetLevels
    };
  }

  async deleteDevelopmentOverride(input: { playerId: number; clubId: number }): Promise<void> {
    await PlayerModel.updateOne(
      { playerId: input.playerId, clubId: input.clubId },
      { $unset: { development: 1 } }
    );
  }
}

function mapPlayer(player: {
  _id: Types.ObjectId;
  playerId: number;
  clubId: number;
  name: string;
  countryId?: number | null;
  countryName?: string | null;
  age?: number | null;
  position?: string | null;
  skills?: Record<string, number> | null;
  marketValue?: number | null;
  wage?: number | null;
  cards?: { yellow?: number; red?: number } | null;
  injury?: { days?: number | null; severe?: boolean | null } | null;
  currentGameWeek?: number | null;
  development?: {
    profile?: PersistedDevelopmentProfile | null;
    targetLevels?: Map<string, number> | Record<string, number> | null;
  } | null;
}): PersistedPlayer {
  const development = player.development
    ? {
        profile: player.development.profile ?? null,
        targetLevels: player.development.targetLevels
          ? player.development.targetLevels instanceof Map
            ? Object.fromEntries(player.development.targetLevels.entries())
            : player.development.targetLevels
          : {}
      }
    : null;
  const hasDevelopmentOverride =
    development !== null &&
    (development.profile !== null || Object.keys(development.targetLevels).length > 0);

  return {
    id: player._id.toString(),
    playerId: player.playerId,
    clubId: player.clubId,
    name: player.name,
    countryId: player.countryId ?? null,
    countryName: player.countryName ?? null,
    age: player.age ?? null,
    position: player.position ?? null,
    skills: player.skills ?? null,
    marketValue: player.marketValue ?? null,
    wage: player.wage ?? null,
    cards: {
      yellow: player.cards?.yellow ?? 0,
      red: player.cards?.red ?? 0
    },
    injury: {
      days: player.injury?.days ?? null,
      severe: player.injury?.severe ?? null
    },
    currentGameWeek: player.currentGameWeek ?? null,
    development: hasDevelopmentOverride ? development : null
  };
}
