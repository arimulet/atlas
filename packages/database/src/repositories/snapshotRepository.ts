import { Types, type ClientSession } from "mongoose";
import { ClubModel } from "../models/club.js";
import { CountryModel } from "../models/country.js";
import { PlayerModel } from "../models/player.js";
import { SnapshotModel } from "../models/snapshot.js";
import type {
  PersistedJuniorSnapshot,
  PersistedPlayerSnapshot,
  PersistedSnapshot
} from "./types.js";
import { ClubId } from "./clubRepository.js";

type SnapshotPlayerInput = Omit<PersistedPlayerSnapshot, "id" | "name"> & { name?: string };

type SnapshotJuniorInput = Omit<PersistedJuniorSnapshot, "id" | "initialLevel"> & {
  initialLevel?: number | null;
};

export interface SaveSnapshotInput {
  clubId: number;
  schemaVersion: string;
  snapshotDate: Date;
  gameWeek: number | null;
  week: number | null;
  importedAt: Date;
  naturalKey?: string | null;
  players: SnapshotPlayerInput[];
  juniors?: SnapshotJuniorInput[];
}

export class MongoSnapshotRepository {
  async save(input: SaveSnapshotInput, session?: ClientSession): Promise<PersistedSnapshot> {
    const document = {
      clubId: input.clubId,
      schemaVersion: input.schemaVersion,
      snapshotDate: input.snapshotDate,
      gameWeek: input.gameWeek,
      week: input.week,
      importedAt: input.importedAt,
      naturalKey: input.naturalKey ?? null,
      players: input.players.map((player) => {
        const persistedPlayer = { ...player };
        delete persistedPlayer.name;
        return persistedPlayer;
      }),
      juniors: (input.juniors ?? []).map((junior) => ({
        playerId: junior.playerId,
        name: junior.name,
        age: junior.age,
        initialLevel: junior.initialLevel ?? null,
        weeksRemaining: junior.weeksRemaining ?? null,
        skill: junior.skill ?? null,
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
        existingSnapshot
          ? { _id: existingSnapshot._id }
          : {
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

    return this.hydrateSnapshot(snapshot.toObject());
  }

  async findById(id: string): Promise<PersistedSnapshot | null> {
    const snapshot = await SnapshotModel.findById(id);
    return snapshot ? this.hydrateSnapshot(snapshot.toObject()) : null;
  }

  async listByClub(clubId: ClubId): Promise<PersistedSnapshot[]> {
    const numericClubId = await this.resolveNumericClubId(clubId);
    const snapshots = await SnapshotModel.find({ clubId: numericClubId }).sort({
      snapshotDate: 1
    });
    return this.hydrateSnapshots(snapshots.map((snapshot) => snapshot.toObject()));
  }

  async findByClubAndDate(clubId: ClubId, snapshotDate: Date): Promise<PersistedSnapshot[]> {
    const numericClubId = await this.resolveNumericClubId(clubId);
    const snapshots = await SnapshotModel.find({
      clubId: numericClubId,
      snapshotDate
    }).sort({ importedAt: 1 });

    return this.hydrateSnapshots(snapshots.map((snapshot) => snapshot.toObject()));
  }

  private async hydrateSnapshots(snapshots: SnapshotDocumentShape[]): Promise<PersistedSnapshot[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const players = await PlayerModel.find({ clubId: snapshots[0]!.clubId })
      .select({ playerId: 1, name: 1, countryId: 1 })
      .lean();
    const countryIds = [
      ...new Set(
        players.flatMap((player) =>
          typeof player.countryId === "number" ? [player.countryId] : []
        )
      )
    ];
    const countries = await CountryModel.find({ countryId: { $in: countryIds } })
      .select({ countryId: 1, name: 1 })
      .lean();
    const countryNames = new Map(countries.map((country) => [country.countryId, country.name]));
    const playerDetails = new Map(
      players.map((player) => [
        player.playerId,
        {
          name: player.name,
          countryName:
            typeof player.countryId === "number"
              ? (countryNames.get(player.countryId) ?? null)
              : null
        }
      ])
    );

    return snapshots.map((snapshot) => mapSnapshot(snapshot, playerDetails));
  }

  private async hydrateSnapshot(snapshot: SnapshotDocumentShape): Promise<PersistedSnapshot> {
    const snapshots = await this.hydrateSnapshots([snapshot]);
    return snapshots[0]!;
  }

  private async resolveNumericClubId(clubId: ClubId): Promise<number> {
    if (typeof clubId === "number") {
      return requireNumericClubId(clubId);
    }

    const numericClubId = Number(clubId);
    if (Number.isInteger(numericClubId) && numericClubId > 0) {
      return numericClubId;
    }

    const club = await ClubModel.findById(clubId).select({ clubId: 1 }).lean();
    if (!club || typeof club.clubId !== "number") {
      throw new Error(`Club not found: ${clubId}`);
    }

    return club.clubId;
  }
}

interface SnapshotDocumentShape {
  _id: Types.ObjectId;
  clubId: number;
  schemaVersion: string;
  snapshotDate: Date;
  gameWeek?: number | null;
  week?: number | null;
  importedAt: Date;
  players: Array<{
    _id: Types.ObjectId;
    playerId: number;
    name?: string;
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
    initialLevel?: number | null;
    weeksRemaining?: number | null;
    skill?: number | null;
    status?: "in_academy" | "ready_for_promotion" | "promoted";
  }>;
}

function mapSnapshot(
  snapshot: SnapshotDocumentShape,
  playerDetails: ReadonlyMap<number, { name: string; countryName: string | null }>
): PersistedSnapshot {
  return {
    id: snapshot._id.toString(),
    clubId: snapshot.clubId,
    schemaVersion: snapshot.schemaVersion,
    snapshotDate: snapshot.snapshotDate,
    gameWeek: snapshot.gameWeek ?? null,
    week: snapshot.week ?? null,
    importedAt: snapshot.importedAt,
    players: snapshot.players.map((player) => ({
      id: player._id.toString(),
      playerId: player.playerId,
      name: playerDetails.get(player.playerId)?.name ?? player.name ?? `Player ${player.playerId}`,
      countryName: playerDetails.get(player.playerId)?.countryName ?? null,
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
      initialLevel: junior.initialLevel ?? junior.skill ?? null,
      weeksRemaining: junior.weeksRemaining ?? null,
      skill: junior.skill ?? null,
      status: junior.status ?? "in_academy"
    }))
  };
}

function requireNumericClubId(clubId: number): number {
  if (!Number.isInteger(clubId) || clubId <= 0) {
    throw new Error(`Club id must be a positive integer: ${clubId}.`);
  }

  return clubId;
}
