import { Types, type ClientSession } from "mongoose";
import { SnapshotModel } from "../models/snapshot.js";
import type {
  PersistedJuniorSnapshot,
  PersistedPlayerSnapshot,
  PersistedSnapshot,
  SnapshotSource
} from "./types.js";
import { ClubId } from "./clubRepository.js";

export interface SaveSnapshotInput {
  clubId: string;
  schemaVersion: string;
  snapshotDate: Date;
  gameWeek: number | null;
  week: number | null;
  importedAt: Date;
  source: SnapshotSource;
  sourceVersion?: string | null;
  naturalKey?: string | null;
  players: Array<Omit<PersistedPlayerSnapshot, "id">>;
  juniors?: Array<Omit<PersistedJuniorSnapshot, "id" | "skill"> & { skill: number }>;
}

export class MongoSnapshotRepository {
  async save(input: SaveSnapshotInput, session?: ClientSession): Promise<PersistedSnapshot> {
    const document = {
      clubId: new Types.ObjectId(input.clubId),
      schemaVersion: input.schemaVersion,
      snapshotDate: input.snapshotDate,
      gameWeek: input.gameWeek,
      week: input.week,
      importedAt: input.importedAt,
      source: input.source,
      sourceVersion: input.sourceVersion ?? null,
      naturalKey: input.naturalKey ?? null,
      players: input.players.map((player) => ({
        ...player
      })),
      juniors: (input.juniors ?? []).map((junior) => ({
        playerId: junior.playerId,
        name: junior.name,
        age: junior.age,
        initialWeeksRemaining: junior.initialWeeksRemaining ?? null,
        weeksRemaining: junior.weeksRemaining ?? null,
        skill: junior.skill,
        status: junior.status ?? "in_academy"
      }))
    };

    let snapshot;
    if (input.naturalKey && input.gameWeek !== null) {
      const legacyQuery = SnapshotModel.findOne({
        clubId: document.clubId,
        gameWeek: input.gameWeek
      }).sort({ importedAt: -1 });
      if (session) {
        legacyQuery.session(session);
      }
      const existingSnapshot = await legacyQuery;
      snapshot = await SnapshotModel.findOneAndUpdate(
        existingSnapshot ? { _id: existingSnapshot._id } : {
          clubId: document.clubId,
          gameWeek: input.gameWeek,
          naturalKey: input.naturalKey
        },
        { $set: document },
        {
          new: true,
          upsert: existingSnapshot === null,
          setDefaultsOnInsert: true,
          session
        }
      );
    } else {
      snapshot = await SnapshotModel.create([document], { session }).then(
        (documents) => documents[0]
      );
    }

    if (!snapshot) {
      throw new Error(`Snapshot could not be persisted: ${input.clubId}/${input.gameWeek}.`);
    }

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
  gameWeek?: number | null;
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
    playerId: number;
    name: string;
    age: number;
    wage: number;
    value: number;
    training: { position: number; advanced: boolean };
    form?: number | null;
    availabilityStatus?: PersistedPlayerSnapshot["availabilityStatus"];
    observedPosition?: PersistedPlayerSnapshot["observedPosition"];
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
  }>;
  juniors?: Array<{
    _id: Types.ObjectId;
    playerId: number;
    name: string;
    age: number;
    initialWeeksRemaining?: number | null;
    weeksRemaining?: number | null;
    skill?: number | null;
    status?: "in_academy" | "ready_for_promotion" | "promoted";
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
    gameWeek: snapshot.gameWeek ?? null,
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
      playerId: player.playerId,
      name: player.name,
      age: player.age,
      wage: player.wage,
      value: player.value,
      training: {
        position: player.training.position,
        advanced: player.training.advanced
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
      }
    })),
    juniors: (snapshot.juniors ?? []).map((junior) => ({
      id: junior._id.toString(),
      playerId: junior.playerId,
      name: junior.name,
      age: junior.age,
      initialWeeksRemaining: junior.initialWeeksRemaining ?? null,
      weeksRemaining: junior.weeksRemaining ?? null,
      skill: junior.skill ?? null,
      status: junior.status ?? "in_academy"
    }))
  };
}
