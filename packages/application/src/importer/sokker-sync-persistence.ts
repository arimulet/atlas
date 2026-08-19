import {
  mongoTransactionsAvailable,
  MongoClubRepository,
  MongoClubSnapshotRepository,
  MongoJuniorRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoSyncRunRepository,
  MongoTrainerRepository,
  MongoTrainingSummaryRepository,
  MongoTrainingWeekRepository,
  withMongoTransaction,
  type MongoSession
} from "@atlas/database";

import type {
  SokkerSyncPayload,
  SokkerSyncPersistenceResult,
  ValidatedSokkerSyncPayload
} from "./types.js";
import { mapJuniorsToSnapshotJuniors, mapPlayersToSnapshotPlayers } from "./snapshot-mappers.js";

const SYNC_SNAPSHOT_NATURAL_KEY = "sokker-json-api-sync";

export interface SokkerSyncPersistenceRepositories {
  clubs: MongoClubRepository;
  clubSnapshots: MongoClubSnapshotRepository;
  juniors: MongoJuniorRepository;
  players: MongoPlayerRepository;
  snapshots: MongoSnapshotRepository;
  syncRuns: MongoSyncRunRepository;
  trainers: MongoTrainerRepository;
  trainingSummaries: MongoTrainingSummaryRepository;
  trainingWeeks: MongoTrainingWeekRepository;
}

export class SokkerSyncPersistence {
  constructor(
    private readonly repositories: SokkerSyncPersistenceRepositories = createRepositories()
  ) {}

  async persist(
    validatedPayload: ValidatedSokkerSyncPayload
  ): Promise<SokkerSyncPersistenceResult> {
    const payload = validatedPayload.payload;
    const teamId = payload.current.team.id;
    const gameWeek = payload.current.calendar.gameWeek;
    const syncRunId = await this.repositories.syncRuns.start({ teamId, gameWeek });
    const importedAt = new Date();

    try {
      const useTransaction = mongoTransactionsAvailable();
      const persist = (session?: MongoSession) =>
        this.persistResources(payload, importedAt, session);
      const resources = useTransaction ? await withMongoTransaction(persist) : await persist();

      await this.repositories.syncRuns.complete(syncRunId);

      return {
        syncRunId,
        teamId,
        gameWeek,
        usedTransaction: useTransaction,
        ...resources
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      try {
        await this.repositories.syncRuns.fail(syncRunId, message);
      } catch (syncRunCause) {
        throw new Error(
          `Failed to persist Sokker sync teamId=${teamId} gameWeek=${gameWeek}; also failed to mark SyncRun failed.`,
          { cause: syncRunCause }
        );
      }
      throw new Error(
        `Failed to persist Sokker sync teamId=${teamId} gameWeek=${gameWeek}: ${message}.`,
        { cause }
      );
    }
  }

  private async persistResources(
    payload: SokkerSyncPayload,
    importedAt: Date,
    session?: MongoSession
  ): Promise<
    Omit<SokkerSyncPersistenceResult, "syncRunId" | "teamId" | "gameWeek" | "usedTransaction">
  > {
    const teamId = payload.current.team.id;
    const currentDate = gameDate(payload.current.calendar.date);
    const club = await persistStep("Club", `${teamId}`, () =>
      this.repositories.clubs.save(
        {
          clubId: teamId,
          country: payload.current.team.country.code,
          name: payload.current.team.name,
          gameWeek: payload.current.calendar.gameWeek,
          week: payload.current.calendar.seasonWeek,
          lastSnapshotDate: currentDate,
          sourceType: "sokker-json-api",
          observedAt: importedAt,
          currency: { name: payload.current.budget.currency, rate: 1 },
          budget: payload.current.budget
        },
        session
      )
    );

    for (const player of payload.players) {
      await persistStep("Player", `${teamId}/${player.id}`, () =>
        this.repositories.players.resolveHistoricalIdentity(
          { playerId: player.id, clubId: teamId, name: player.name.fullName },
          session
        )
      );
    }

    const snapshotPlayers = mapPlayersToSnapshotPlayers(payload.players, payload.trainingWeeks).map(
      (player) => ({
        ...player,
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
      })
    );
    const snapshotJuniors = mapJuniorsToSnapshotJuniors(payload.juniors).map((junior) => ({
      ...junior,
      initialWeeksRemaining: junior.initialWeeksRemaining ?? null,
      weeksRemaining: junior.weeksRemaining ?? null,
      status: junior.status ?? "in_academy"
    }));

    const snapshot = await persistStep(
      "PlayerSnapshot",
      `${teamId}/${payload.current.calendar.gameWeek}`,
      () =>
        this.repositories.snapshots.save(
          {
            clubId: club.id,
            schemaVersion: "atlas.player-snapshot.v0",
            snapshotDate: currentDate,
            gameWeek: payload.current.calendar.gameWeek,
            week: payload.current.calendar.seasonWeek,
            importedAt,
            naturalKey: SYNC_SNAPSHOT_NATURAL_KEY,
            source: {
              type: "sokker-json-api",
              exportedAt: importedAt,
              pageUrl: null,
              locale: null
            },
            players: snapshotPlayers,
            juniors: snapshotJuniors
          },
          session
        )
    );

    for (const report of payload.trainingWeeks) {
      await persistStep("TrainingHistory", `${report.playerId}/${report.gameWeek}`, () =>
        this.repositories.trainingWeeks.save(
          {
            clubId: teamId,
            playerId: report.playerId,
            gameWeek: report.gameWeek,
            season: report.season,
            seasonWeek: report.seasonWeek,
            date: gameDate(report.date),
            type: report.trainedSkill,
            kind: report.kind,
            intensity: report.intensity,
            age: report.age,
            skills: { ...report.skills },
            skillsChange: { ...report.skillsChange },
            skillChanges: report.skillChanges.map((change) => ({ ...change }))
          },
          session
        )
      );
    }

    await persistStep("ClubSnapshot", `${teamId}/${payload.current.calendar.gameWeek}`, () =>
      this.repositories.clubSnapshots.upsert(
        {
          teamId,
          gameWeek: payload.current.calendar.gameWeek,
          season: payload.current.calendar.season,
          seasonWeek: payload.current.calendar.seasonWeek,
          date: currentDate,
          team: payload.current.team,
          budget: payload.current.budget
        },
        session
      )
    );

    await persistStep("Trainer", `${teamId}`, async () => {
      await this.repositories.trainers.deactivateMissing(
        teamId,
        payload.trainers.map((trainer) => trainer.id),
        session
      );
      await this.repositories.trainers.upsertMany(
        payload.trainers.map((trainer) => ({
          teamId,
          trainerId: trainer.id,
          name: trainer.name,
          assignment: trainer.assignment,
          contracted: trainer.contracted,
          salary: trainer.salary,
          age: trainer.age,
          skills: { ...trainer.skills },
          averageEffectivenessPercent: trainer.averageEffectivenessPercent,
          status: trainer.status
        })),
        session
      );
    });

    await persistStep("Junior", `${teamId}`, async () => {
      await this.repositories.juniors.deactivateMissing(
        teamId,
        payload.juniors.map((junior) => junior.id),
        session
      );
      await this.repositories.juniors.upsertMany(
        payload.juniors.map((junior) => ({
          teamId,
          juniorId: junior.id,
          name: junior.name,
          age: junior.age,
          currentLevel: junior.currentLevel,
          weeksLeft: junior.weeksLeft
        })),
        session
      );
    });

    await persistStep("TrainingSummary", `${teamId}`, () =>
      this.repositories.trainingSummaries.upsertMany(
        payload.trainingSummary.weeks.map((week) => ({
          teamId,
          gameWeek: week.gameWeek,
          season: week.season,
          seasonWeek: week.seasonWeek,
          date: gameDate(week.date),
          players: week.players,
          juniors: week.juniors
        })),
        session
      )
    );

    return {
      clubId: club.id,
      snapshotId: snapshot.id,
      upserted: {
        players: payload.players.length,
        playerSnapshots: 1,
        trainingWeeks: payload.trainingWeeks.length,
        trainers: payload.trainers.length,
        juniors: payload.juniors.length,
        trainingSummaryWeeks: payload.trainingSummary.weeks.length
      }
    };
  }
}

export async function persistSokkerSync(
  validatedPayload: ValidatedSokkerSyncPayload
): Promise<SokkerSyncPersistenceResult> {
  return new SokkerSyncPersistence().persist(validatedPayload);
}

function createRepositories(): SokkerSyncPersistenceRepositories {
  return {
    clubs: new MongoClubRepository(),
    clubSnapshots: new MongoClubSnapshotRepository(),
    juniors: new MongoJuniorRepository(),
    players: new MongoPlayerRepository(),
    snapshots: new MongoSnapshotRepository(),
    syncRuns: new MongoSyncRunRepository(),
    trainers: new MongoTrainerRepository(),
    trainingSummaries: new MongoTrainingSummaryRepository(),
    trainingWeeks: new MongoTrainingWeekRepository()
  };
}

async function persistStep<T>(
  entity: string,
  naturalKey: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw new Error(`Failed to upsert ${entity} naturalKey=${naturalKey}.`, { cause });
  }
}

function gameDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
