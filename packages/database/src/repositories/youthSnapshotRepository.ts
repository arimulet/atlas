import { Types } from "mongoose";
import { YouthSnapshotModel } from "../models/youthSnapshot.js";
import type {
  PersistedYouthPlayerSnapshot,
  PersistedYouthSnapshot,
  SnapshotMoney,
  SnapshotSource
} from "./types.js";
import { ClubId } from "./clubRepository.js";

export interface SaveYouthSnapshotInput {
  clubId: string;
  schemaVersion: string;
  snapshotDate: Date;
  season: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion?: string | null;
  weeklyInvestment?: SnapshotMoney | null;
  players: Array<Omit<PersistedYouthPlayerSnapshot, "id">>;
}

export class MongoYouthSnapshotRepository {
  async save(input: SaveYouthSnapshotInput): Promise<PersistedYouthSnapshot> {
    const snapshot = await YouthSnapshotModel.create({
      clubId: new Types.ObjectId(input.clubId),
      schemaVersion: input.schemaVersion,
      snapshotDate: input.snapshotDate,
      season: input.season,
      week: input.week,
      importedAt: input.importedAt,
      source: input.source,
      sourceVersion: input.sourceVersion ?? null,
      weeklyInvestment: input.weeklyInvestment ?? null,
      players: input.players.map((player) => ({
        externalId: player.externalId,
        name: player.name,
        age: player.age,
        weeksInAcademy: player.weeksInAcademy ?? null,
        weeksRemaining: player.weeksRemaining ?? null,
        estimatedLevel: player.estimatedLevel ?? null,
        status: player.status ?? "in_academy"
      }))
    });

    return mapYouthSnapshot(snapshot.toObject());
  }

  async findById(id: string): Promise<PersistedYouthSnapshot | null> {
    const snapshot = await YouthSnapshotModel.findById(id);
    return snapshot ? mapYouthSnapshot(snapshot.toObject()) : null;
  }

  async listByClub(clubId: ClubId): Promise<PersistedYouthSnapshot[]> {
    const snapshots = await YouthSnapshotModel.find({
      clubId: new Types.ObjectId(clubId)
    }).sort({
      snapshotDate: 1
    });
    return snapshots.map((snapshot) => mapYouthSnapshot(snapshot.toObject()));
  }

  async findByClubAndDate(clubId: string, snapshotDate: Date): Promise<PersistedYouthSnapshot[]> {
    const snapshots = await YouthSnapshotModel.find({
      clubId: new Types.ObjectId(clubId),
      snapshotDate
    }).sort({ importedAt: 1 });

    return snapshots.map((snapshot) => mapYouthSnapshot(snapshot.toObject()));
  }
}

export const MongoYouthAcademySnapshotRepository = MongoYouthSnapshotRepository;

function mapYouthSnapshot(snapshot: {
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
  weeklyInvestment?: {
    amount: number;
    currency?: string | null;
  } | null;
  players: Array<{
    _id: Types.ObjectId;
    externalId?: string | null;
    name: string;
    age: number;
    weeksInAcademy?: number | null;
    weeksRemaining?: number | null;
    estimatedLevel?: string | null;
    status?: "in_academy" | "ready_for_promotion" | "promoted";
  }>;
}): PersistedYouthSnapshot {
  if (!snapshot.source) {
    throw new Error(`Youth snapshot source is missing: ${snapshot._id.toString()}`);
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
    weeklyInvestment: snapshot.weeklyInvestment
      ? {
          amount: snapshot.weeklyInvestment.amount,
          currency: snapshot.weeklyInvestment.currency ?? null
        }
      : null,
    players: snapshot.players.map((player) => ({
      id: player._id.toString(),
      externalId: player.externalId ?? null,
      name: player.name,
      age: player.age,
      weeksInAcademy: player.weeksInAcademy ?? null,
      weeksRemaining: player.weeksRemaining ?? null,
      estimatedLevel: player.estimatedLevel ?? null,
      status: player.status ?? "in_academy"
    }))
  };
}
