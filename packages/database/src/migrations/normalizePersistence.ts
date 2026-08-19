import { ClubModel } from "../models/club.js";
import { ClubSnapshotModel } from "../models/clubSnapshot.js";
import { ImportEventModel } from "../models/importEvent.js";
import { JuniorModel } from "../models/junior.js";
import { SnapshotModel } from "../models/snapshot.js";
import { TrainerModel } from "../models/trainer.js";
import { TrainingSummaryModel } from "../models/trainingSummary.js";
import { TrainingWeekModel } from "../models/trainingWeek.js";
import type { PersistedClubStaffMember } from "../repositories/types.js";

export interface NormalizePersistenceOptions {
  dropLegacyCollections?: boolean;
}

export interface NormalizePersistenceResult {
  clubs: { matched: number; modified: number };
  snapshots: { matched: number; modified: number };
  importEvents: { matched: number; modified: number };
  trainingWeeks: { matched: number; modified: number };
  legacyCollections: {
    clubSnapshots: number;
    trainers: number;
    juniors: number;
    trainingSummaries: number;
  };
}

/**
 * Removes fields that are no longer part of the normalized persistence model and
 * copies the legacy trainer collection into club.staff. It is intentionally not
 * executed on startup and never drops collections unless explicitly requested.
 */
export async function normalizeMongoPersistence(
  options: NormalizePersistenceOptions = {}
): Promise<NormalizePersistenceResult> {
  const staffMigration = await migrateLegacyStaff();
  const clubs = await ClubModel.collection.updateMany(
    {},
    { $unset: { sourceType: "", "budget.currency": "" } }
  );
  const snapshots = await SnapshotModel.collection.updateMany(
    {},
    { $unset: { source: "", sourceVersion: "", "players.$[].name": "" } }
  );
  const importEvents = await ImportEventModel.collection.updateMany(
    {},
    { $unset: { sourceType: "" } }
  );
  const trainingWeeks = await TrainingWeekModel.collection.updateMany({}, [
    {
      $set: {
        skillsChange: {
          stamina: "$skillsChange.stamina",
          keeper: "$skillsChange.keeper",
          playmaking: "$skillsChange.playmaking",
          passing: "$skillsChange.passing",
          technique: "$skillsChange.technique",
          defending: "$skillsChange.defending",
          striker: "$skillsChange.striker",
          pace: "$skillsChange.pace",
          up: "$skillsChange.up",
          down: "$skillsChange.down"
        }
      }
    },
    { $unset: "skills" },
    { $unset: "skillChanges" }
  ]);

  const legacyCollections = {
    clubSnapshots: await ClubSnapshotModel.countDocuments(),
    trainers: await TrainerModel.countDocuments(),
    juniors: await JuniorModel.countDocuments(),
    trainingSummaries: await TrainingSummaryModel.countDocuments()
  };

  if (options.dropLegacyCollections) {
    await Promise.all([
      dropCollection(ClubSnapshotModel),
      dropCollection(TrainerModel),
      dropCollection(JuniorModel),
      dropCollection(TrainingSummaryModel)
    ]);
  }

  return {
    clubs: {
      matched: clubs.matchedCount,
      modified: clubs.modifiedCount + staffMigration.modified
    },
    snapshots: { matched: snapshots.matchedCount, modified: snapshots.modifiedCount },
    importEvents: { matched: importEvents.matchedCount, modified: importEvents.modifiedCount },
    trainingWeeks: { matched: trainingWeeks.matchedCount, modified: trainingWeeks.modifiedCount },
    legacyCollections
  };
}

async function migrateLegacyStaff(): Promise<{ modified: number }> {
  const trainers = await TrainerModel.find({ active: true }).lean();
  const trainersByClub = new Map<number, PersistedClubStaffMember[]>();

  for (const trainer of trainers) {
    const staff = trainersByClub.get(trainer.teamId) ?? [];
    staff.push({
      trainerId: trainer.trainerId,
      name: trainer.name?.fullName ?? `Trainer ${trainer.trainerId}`,
      assignment: trainer.assignment,
      contracted: trainer.contracted,
      salary: trainer.salary?.value ?? 0,
      age: trainer.age,
      skills: trainer.skills as PersistedClubStaffMember["skills"],
      averageEffectivenessPercent: trainer.averageEffectivenessPercent,
      status: trainer.status,
      active: trainer.active
    });
    trainersByClub.set(trainer.teamId, staff);
  }

  let modified = 0;
  for (const [clubId, staff] of trainersByClub) {
    const result = await ClubModel.updateOne({ clubId }, { $set: { staff } });
    modified += result.modifiedCount;
  }

  return { modified };
}

async function dropCollection(model: {
  collection: { drop: () => Promise<boolean> };
}): Promise<void> {
  try {
    await model.collection.drop();
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes("ns not found")) {
      throw cause;
    }
  }
}
