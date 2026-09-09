import { type ClientSession } from "mongoose";
import { SnapshotModel } from "../models/snapshot.js";
import { TrainingWeekModel } from "../models/trainingWeek.js";
import type {
  PersistedPlayerSkills,
  PersistedPlayerSkillsChange,
  PersistedPlayerTrainingWeek,
  PersistedTrainingSkill,
  SavePlayerTrainingWeekInput,
  SnapshotSkillSet
} from "./types.js";

export class MongoTrainingWeekRepository {
  async save(
    input: SavePlayerTrainingWeekInput,
    session?: ClientSession
  ): Promise<PersistedPlayerTrainingWeek> {
    const week = await TrainingWeekModel.findOneAndUpdate(
      { clubId: input.clubId, playerId: input.playerId, gameWeek: input.gameWeek },
      { $set: input },
      { new: true, upsert: true, setDefaultsOnInsert: true, session }
    );

    if (!week) {
      throw new Error(`Training week could not be persisted: ${input.playerId}/${input.gameWeek}.`);
    }

    const snapshots = await loadTrainingSnapshots(input.clubId);
    return mapTrainingWeek(week.toObject(), buildTrainingSnapshotIndex(snapshots));
  }

  async listByClub(clubId: number): Promise<PersistedPlayerTrainingWeek[]> {
    const [weeks, snapshots] = await Promise.all([
      TrainingWeekModel.find({ clubId }).sort({ gameWeek: 1, playerId: 1 }),
      loadTrainingSnapshots(clubId)
    ]);
    const snapshotIndex = buildTrainingSnapshotIndex(snapshots);
    return weeks.map((week) => mapTrainingWeek(week.toObject(), snapshotIndex));
  }

  async listByPlayer(clubId: number, playerId: number): Promise<PersistedPlayerTrainingWeek[]> {
    const [weeks, snapshots] = await Promise.all([
      TrainingWeekModel.find({ clubId, playerId }).sort({ gameWeek: 1 }),
      loadTrainingSnapshots(clubId)
    ]);
    const snapshotIndex = buildTrainingSnapshotIndex(snapshots);
    return weeks.map((week) => mapTrainingWeek(week.toObject(), snapshotIndex));
  }
}

type TrainingWeekShape = {
  _id: unknown;
  clubId: number;
  playerId: number;
  gameWeek: number;
  season?: number | null;
  seasonWeek: number;
  date: Date;
  type: PersistedPlayerTrainingWeek["type"];
  kind: PersistedPlayerTrainingWeek["kind"];
  intensity: number;
  age: number;
  skillsChange: PersistedPlayerSkillsChange;
  skills?: PersistedPlayerSkills;
};

type TrainingSnapshot = {
  gameWeek?: number | null;
  players: Array<{
    playerId: number;
    skills: SnapshotSkillSet;
  }>;
};

type TrainingSnapshotPlayer = TrainingSnapshot["players"][number];
type TrainingSnapshotIndex = Map<number, Map<number, TrainingSnapshotPlayer>>;

function buildTrainingSnapshotIndex(snapshots: readonly TrainingSnapshot[]): TrainingSnapshotIndex {
  const index: TrainingSnapshotIndex = new Map();
  for (const snapshot of snapshots) {
    if (snapshot.gameWeek == null) continue;
    let playerMap = index.get(snapshot.gameWeek);
    if (!playerMap) {
      playerMap = new Map();
      index.set(snapshot.gameWeek, playerMap);
    }
    for (const player of snapshot.players) {
      playerMap.set(player.playerId, player);
    }
  }
  return index;
}

async function loadTrainingSnapshots(clubId: number): Promise<TrainingSnapshot[]> {
  const snapshots = await SnapshotModel.find({ clubId })
    .select({ gameWeek: 1, players: 1 })
    .sort({ gameWeek: 1 })
    .lean();

  return snapshots as unknown as TrainingSnapshot[];
}

function mapTrainingWeek(
  week: TrainingWeekShape,
  snapshots: readonly TrainingSnapshot[] | TrainingSnapshotIndex
): PersistedPlayerTrainingWeek {
  const snapshotPlayer = findSnapshotPlayer(week, snapshots);
  const storedSkills = readSkills(week.skills);
  const skills =
    Object.keys(storedSkills).length > 0
      ? storedSkills
      : snapshotPlayer
        ? mapSnapshotSkills(snapshotPlayer.skills)
        : storedSkills;
  const skillsChange = readSkillsChange(week.skillsChange);

  return {
    id: String(week._id),
    clubId: week.clubId,
    playerId: week.playerId,
    gameWeek: week.gameWeek,
    season: week.season ?? null,
    seasonWeek: week.seasonWeek,
    date: week.date,
    type: week.type,
    kind: week.kind,
    intensity: week.intensity,
    age: week.age,
    skills,
    skillsChange,
    skillChanges: derivePersistedSkillChanges(skills, skillsChange)
  };
}

function findSnapshotPlayer(
  week: TrainingWeekShape,
  snapshots: readonly TrainingSnapshot[] | TrainingSnapshotIndex
): TrainingSnapshotPlayer | null {
  if (snapshots instanceof Map) {
    const sameWeekMap = snapshots.get(week.gameWeek);
    const afterWeekMap = snapshots.get(week.gameWeek + 1);
    return sameWeekMap?.get(week.playerId) ?? afterWeekMap?.get(week.playerId) ?? null;
  }

  const sameWeek = snapshots.find((snapshot) => snapshot.gameWeek === week.gameWeek);
  const afterTraining = snapshots.find((snapshot) => snapshot.gameWeek === week.gameWeek + 1);
  const snapshot = sameWeek ?? afterTraining;
  return snapshot?.players.find((player) => player.playerId === week.playerId) ?? null;
}

function mapSnapshotSkills(source: SnapshotSkillSet): PersistedPlayerSkills {
  return {
    ...(source.stamina !== null ? { stamina: source.stamina } : {}),
    ...(source.keeper !== null ? { keeper: source.keeper } : {}),
    ...(source.playmaker !== null ? { playmaking: source.playmaker } : {}),
    ...(source.passing !== null ? { passing: source.passing } : {}),
    ...(source.technique !== null ? { technique: source.technique } : {}),
    ...(source.defender !== null ? { defending: source.defender } : {}),
    ...(source.striker !== null ? { striker: source.striker } : {}),
    ...(source.pace !== null ? { pace: source.pace } : {})
  };
}

function readSkills(input: PersistedPlayerSkills | undefined): PersistedPlayerSkills {
  return {
    ...(input?.stamina !== undefined ? { stamina: input.stamina } : {}),
    ...(input?.keeper !== undefined ? { keeper: input.keeper } : {}),
    ...(input?.playmaking !== undefined ? { playmaking: input.playmaking } : {}),
    ...(input?.passing !== undefined ? { passing: input.passing } : {}),
    ...(input?.technique !== undefined ? { technique: input.technique } : {}),
    ...(input?.defending !== undefined ? { defending: input.defending } : {}),
    ...(input?.striker !== undefined ? { striker: input.striker } : {}),
    ...(input?.pace !== undefined ? { pace: input.pace } : {})
  };
}

function readSkillsChange(input: PersistedPlayerSkillsChange): PersistedPlayerSkillsChange {
  return {
    ...(input.stamina !== undefined ? { stamina: input.stamina } : {}),
    ...(input.keeper !== undefined ? { keeper: input.keeper } : {}),
    ...(input.playmaking !== undefined ? { playmaking: input.playmaking } : {}),
    ...(input.passing !== undefined ? { passing: input.passing } : {}),
    ...(input.technique !== undefined ? { technique: input.technique } : {}),
    ...(input.defending !== undefined ? { defending: input.defending } : {}),
    ...(input.striker !== undefined ? { striker: input.striker } : {}),
    ...(input.pace !== undefined ? { pace: input.pace } : {}),
    up: input.up ?? 0,
    down: input.down ?? 0
  };
}

function derivePersistedSkillChanges(
  skills: PersistedPlayerSkills,
  changes: PersistedPlayerSkillsChange
): PersistedPlayerTrainingWeek["skillChanges"] {
  const skillNames: PersistedTrainingSkill[] = [
    "stamina",
    "keeper",
    "playmaking",
    "passing",
    "technique",
    "defending",
    "striker",
    "pace"
  ];

  return skillNames.flatMap((skill) => {
    const delta = changes[skill];
    const after = skills[skill];

    if (delta === undefined || delta === 0 || after === undefined) {
      return [];
    }

    return [
      {
        skill,
        before: after - delta,
        after,
        delta,
        direction: delta > 0 ? "up" : "down"
      }
    ];
  });
}
