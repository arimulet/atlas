import { type ClientSession } from "mongoose";
import { TrainingWeekModel } from "../models/trainingWeek.js";
import type {
  PersistedPlayerSkills,
  PersistedPlayerSkillsChange,
  PersistedPlayerTrainingWeek,
  PersistedTrainingSkill,
  SavePlayerTrainingWeekInput
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

    return mapTrainingWeek(week.toObject());
  }

  async listByClub(clubId: number): Promise<PersistedPlayerTrainingWeek[]> {
    const weeks = await TrainingWeekModel.find({ clubId }).sort({ gameWeek: 1, playerId: 1 });
    return weeks.map((week) => mapTrainingWeek(week.toObject()));
  }

  async listByPlayer(clubId: number, playerId: number): Promise<PersistedPlayerTrainingWeek[]> {
    const weeks = await TrainingWeekModel.find({ clubId, playerId }).sort({ gameWeek: 1 });
    return weeks.map((week) => mapTrainingWeek(week.toObject()));
  }
}

function mapTrainingWeek(week: {
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
  skills: PersistedPlayerTrainingWeek["skills"];
  skillsChange: PersistedPlayerTrainingWeek["skillsChange"];
}): PersistedPlayerTrainingWeek {
  const skillChanges = derivePersistedSkillChanges(
    readSkills(week.skills),
    readSkillsChange(week.skillsChange)
  );

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
    skills: week.skills,
    skillsChange: week.skillsChange,
    skillChanges
  };
}

function readSkills(input: PersistedPlayerSkills): PersistedPlayerSkills {
  return {
    stamina: input.stamina,
    keeper: input.keeper,
    playmaking: input.playmaking,
    passing: input.passing,
    technique: input.technique,
    defending: input.defending,
    striker: input.striker,
    pace: input.pace
  };
}

function readSkillsChange(input: PersistedPlayerSkillsChange): PersistedPlayerSkillsChange {
  return {
    stamina: input.stamina,
    keeper: input.keeper,
    playmaking: input.playmaking,
    passing: input.passing,
    technique: input.technique,
    defending: input.defending,
    striker: input.striker,
    pace: input.pace,
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
