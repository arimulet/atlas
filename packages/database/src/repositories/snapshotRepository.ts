import { Types } from "mongoose";
import { SnapshotModel } from "../models/snapshot.js";
import type { PersistedPlayerSnapshot, PersistedSnapshot, SnapshotSource } from "./types.js";
import { ClubId } from "./clubRepository.js";

export interface SaveSnapshotInput {
  clubId: string;
  schemaVersion: string;
  snapshotDate: Date;
  season: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion?: string | null;
  players: Array<Omit<PersistedPlayerSnapshot, "id">>;
}

export class MongoSnapshotRepository {
  async save(input: SaveSnapshotInput): Promise<PersistedSnapshot> {
    const snapshot = await SnapshotModel.create({
      clubId: new Types.ObjectId(input.clubId),
      schemaVersion: input.schemaVersion,
      snapshotDate: input.snapshotDate,
      season: input.season,
      week: input.week,
      importedAt: input.importedAt,
      source: input.source,
      sourceVersion: input.sourceVersion ?? null,
      players: input.players.map((player) => ({
        ...player,
        playerId: player.playerId ? new Types.ObjectId(player.playerId) : null
      }))
    });

    return mapSnapshot(snapshot.toObject());
  }

  async findById(id: string): Promise<PersistedSnapshot | null> {
    const snapshot = await SnapshotModel.findById(id);
    return snapshot ? mapSnapshot(snapshot.toObject()) : null;
  }

  async listByClub(clubId: ClubId): Promise<PersistedSnapshot[]> {
    const snapshots = await SnapshotModel.find({ clubId: new Types.ObjectId(clubId) }).sort({
      snapshotDate: 1
    });
    return snapshots.map((snapshot) => mapSnapshot(snapshot.toObject()));
  }

  async findByClubAndDate(clubId: string, snapshotDate: Date): Promise<PersistedSnapshot[]> {
    const snapshots = await SnapshotModel.find({
      clubId: new Types.ObjectId(clubId),
      snapshotDate
    }).sort({ importedAt: 1 });

    return snapshots.map((snapshot) => mapSnapshot(snapshot.toObject()));
  }
}

function mapSnapshot(snapshot: {
  _id: Types.ObjectId;
  clubId: Types.ObjectId;
  schemaVersion: string;
  snapshotDate: Date;
  season?: number | null;
  week?: number | null;
  importedAt: Date;
  source?: {
    type: string;
    exportedAt: Date;
    pageUrl?: string | null;
    locale?: string | null;
  } | null;
  sourceVersion?: string | null;
  players: Array<{
    _id: Types.ObjectId;
    playerId?: Types.ObjectId | null;
    externalId?: string | null;
    name: string;
    age: number;
    wage: { amount: number; currency?: string | null };
    estimatedValue: { amount: number; currency?: string | null };
    form?: number | null;
    availabilityStatus?: PersistedPlayerSnapshot["availabilityStatus"];
    observedPosition?: string | null;
    skills: {
      stamina?: number | null;
      pace?: number | null;
      technique?: number | null;
      passing?: number | null;
      keeper?: number | null;
      defender?: number | null;
      playmaker?: number | null;
      striker?: number | null;
    };
    roles?: string[];
  }>;
}): PersistedSnapshot {
  if (!snapshot.source) {
    throw new Error(`Snapshot source is missing: ${snapshot._id.toString()}`);
  }

  return {
    id: snapshot._id.toString(),
    clubId: snapshot.clubId.toString(),
    schemaVersion: snapshot.schemaVersion,
    snapshotDate: snapshot.snapshotDate,
    season: snapshot.season ?? null,
    week: snapshot.week ?? null,
    importedAt: snapshot.importedAt,
    source: {
      type: snapshot.source.type,
      exportedAt: snapshot.source.exportedAt,
      pageUrl: snapshot.source.pageUrl ?? null,
      locale: snapshot.source.locale ?? null
    },
    sourceVersion: snapshot.sourceVersion ?? null,
    players: snapshot.players.map((player) => ({
      id: player._id.toString(),
      playerId: player.playerId?.toString() ?? null,
      externalId: player.externalId ?? null,
      name: player.name,
      age: player.age,
      wage: {
        amount: player.wage.amount,
        currency: player.wage.currency ?? null
      },
      estimatedValue: {
        amount: player.estimatedValue.amount,
        currency: player.estimatedValue.currency ?? null
      },
      form: player.form ?? null,
      availabilityStatus: player.availabilityStatus ?? null,
      observedPosition: player.observedPosition ?? null,
      skills: {
        stamina: player.skills.stamina ?? null,
        pace: player.skills.pace ?? null,
        technique: player.skills.technique ?? null,
        passing: player.skills.passing ?? null,
        keeper: player.skills.keeper ?? null,
        defender: player.skills.defender ?? null,
        playmaker: player.skills.playmaker ?? null,
        striker: player.skills.striker ?? null
      },
      roles: player.roles ?? []
    }))
  };
}
