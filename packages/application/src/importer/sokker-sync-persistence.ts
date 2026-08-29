import {
  mongoTransactionsAvailable,
  MongoClubRepository,
  MongoJuniorRepository,
  MongoJuniorMatchRepository,
  MongoPlayerRepository,
  MongoSnapshotRepository,
  MongoSyncRunRepository,
  MongoTrainingWeekRepository,
  withMongoTransaction,
  type MongoSession,
  type PersistedClubStaffMember,
  type PersistedPlayerSkills,
  type PersistedPlayerSkillsChange
} from "@atlas/database";

import type {
  SokkerSyncPayload,
  SokkerSyncPersistenceResult,
  ValidatedSokkerSyncPayload
} from "./types.js";
import { mapJuniorsToSnapshotJuniors, mapPlayersToSnapshotPlayers } from "./snapshot-mappers.js";

const SYNC_SNAPSHOT_NATURAL_KEY = "sokker-json-api-sync";

/** Current club/player/junior state and factual events are persisted; summaries stay in memory. */
export interface SokkerSyncPersistenceRepositories {
  clubs: MongoClubRepository;
  juniors?: MongoJuniorRepository;
  players: MongoPlayerRepository;
  snapshots: MongoSnapshotRepository;
  syncRuns: MongoSyncRunRepository;
  trainingWeeks: MongoTrainingWeekRepository;
  juniorMatches?: MongoJuniorMatchRepository;
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
          observedAt: importedAt,
          currency: payload.current.budget.currency,
          budget: payload.current.budget.value,
          training: payload.current.training,
          staff: payload.trainers.map(mapTrainerToStaff)
        },
        session
      )
    );

    for (const player of payload.players) {
      await persistStep("Player", `${teamId}/${player.id}`, () =>
        this.repositories.players.resolveHistoricalIdentity(
          {
            playerId: player.id,
            clubId: teamId,
            name: player.name.fullName,
            countryId: player.country.code,
            countryName: player.country.name,
            age: player.age,
            position: player.formation,
            skills: { ...player.skills },
            marketValue: player.value.value,
            wage: player.wage.value,
            cards: player.cards,
            injury: { days: player.injury.daysRemaining, severe: player.injury.severe },
            currentGameWeek: payload.current.calendar.gameWeek
          },
          session
        )
      );
    }

    const juniors = this.repositories.juniors ?? new MongoJuniorRepository();
    await persistStep("Junior", `${teamId}/status`, () =>
      juniors.markMissingStatuses(
        teamId,
        payload.juniors.map((junior) => junior.id),
        payload.players.map((player) => player.id),
        session
      )
    );
    for (const junior of payload.juniors) {
      await persistStep("Junior", `${teamId}/${junior.id}`, () =>
        juniors.resolveCurrentIdentity(
          {
            juniorId: junior.id,
            clubId: teamId,
            name: junior.name.fullName,
            age: junior.age,
            currentLevel: junior.currentLevel,
            weeksLeft: junior.weeksLeft,
            formation: junior.formation ?? null
          },
          session
        )
      );
    }

    const previousSnapshot = (await this.repositories.snapshots.listByClub(club.clubId)).at(-1);
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
    const snapshotJuniors = mapJuniorsToSnapshotJuniors(payload.juniors).map((junior) => {
      const previousJunior = previousSnapshot?.juniors.find(
        (candidate) => candidate.playerId === junior.playerId
      );

      return {
        ...junior,
        initialLevel: previousJunior?.initialLevel ?? junior.skill,
        weeksRemaining: junior.weeksRemaining ?? null,
        status: junior.status ?? "in_academy"
      };
    });

    const latestTrainingWeek = payload.trainingWeeks.length > 0 
      ? (payload.trainingWeeks[0]?.gameWeek ?? payload.current.calendar.gameWeek)
      : payload.current.calendar.gameWeek; // fallback in case API doesn't return training

    const snapshot = await persistStep(
      "PlayerSnapshot",
      `${teamId}/${latestTrainingWeek}`,
      () =>
        this.repositories.snapshots.save(
          {
            clubId: club.clubId,
            schemaVersion: "atlas.player-snapshot.v0",
            snapshotDate: currentDate,
            gameWeek: latestTrainingWeek,
            week: payload.current.calendar.seasonWeek,
            importedAt,
            naturalKey: SYNC_SNAPSHOT_NATURAL_KEY,
            players: snapshotPlayers,
            juniors: snapshotJuniors
          },
          session
        )
    );

    for (const report of payload.trainingWeeks) {
      await persistStep("PlayerTraining", `${report.playerId}/${report.gameWeek}`, () =>
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
            skills: mapPersistedSkills(report.skills),
            skillsChange: mapPersistedSkillsChange(report.skillsChange)
          },
          session
        )
      );
    }

    if (this.repositories.juniorMatches && payload.juniorMatches) {
      for (const match of payload.juniorMatches) {
        await persistStep("JuniorMatch", `${match.matchId}`, () =>
          this.repositories.juniorMatches!.save(
            {
              id: "", // Will be assigned by Mongo
              ...match,
              dateExpected: new Date(match.dateExpected)
            },
            session
          )
        );
      }
    }

    return {
      clubId: club.id,
      snapshotId: snapshot.id,
      upserted: {
        players: payload.players.length,
        playerSnapshots: 1,
        trainingWeeks: payload.trainingWeeks.length,
        trainers: payload.trainers.length,
        juniors: payload.juniors.length,
        trainingSummaryWeeks: 0,
        juniorMatches: payload.juniorMatches?.length ?? 0
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
    juniors: new MongoJuniorRepository(),
    players: new MongoPlayerRepository(),
    snapshots: new MongoSnapshotRepository(),
    syncRuns: new MongoSyncRunRepository(),
    trainingWeeks: new MongoTrainingWeekRepository(),
    juniorMatches: new MongoJuniorMatchRepository()
  };
}

function mapPersistedSkills(
  skills: SokkerSyncPayload["trainingWeeks"][number]["skills"]
): PersistedPlayerSkills {
  return {
    stamina: skills.stamina,
    keeper: skills.keeper,
    playmaking: skills.playmaking,
    passing: skills.passing,
    technique: skills.technique,
    defending: skills.defending,
    striker: skills.striker,
    pace: skills.pace
  };
}
function mapPersistedSkillsChange(
  change: SokkerSyncPayload["trainingWeeks"][number]["skillsChange"]
): PersistedPlayerSkillsChange {
  return {
    stamina: change.stamina,
    keeper: change.keeper,
    playmaking: change.playmaking,
    passing: change.passing,
    technique: change.technique,
    defending: change.defending,
    striker: change.striker,
    pace: change.pace,
    up: change.up,
    down: change.down
  };
}

function mapTrainerToStaff(
  trainer: SokkerSyncPayload["trainers"][number]
): PersistedClubStaffMember {
  return {
    trainerId: trainer.id,
    name: trainer.name.fullName,
    assignment: trainer.assignment,
    contracted: trainer.contracted,
    salary: trainer.salary.value,
    age: trainer.age,
    skills: { ...trainer.skills },
    averageEffectivenessPercent: trainer.averageEffectivenessPercent,
    status: trainer.status,
    active: true
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
