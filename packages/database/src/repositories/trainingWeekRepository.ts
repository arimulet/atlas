import { TrainingWeekModel } from "../models/trainingWeek.js";
import type {
  PersistedPlayerTrainingWeek,
  SavePlayerTrainingWeekInput
} from "./types.js";

export class MongoTrainingWeekRepository {
  async save(input: SavePlayerTrainingWeekInput): Promise<PersistedPlayerTrainingWeek> {
    const week = await TrainingWeekModel.findOneAndUpdate(
      { clubId: input.clubId, playerId: input.playerId, gameWeek: input.gameWeek },
      { $set: input },
      { new: true, upsert: true, setDefaultsOnInsert: true }
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

  async listByPlayer(
    clubId: number,
    playerId: number
  ): Promise<PersistedPlayerTrainingWeek[]> {
    const weeks = await TrainingWeekModel.find({ clubId, playerId }).sort({ gameWeek: 1 });
    return weeks.map((week) => mapTrainingWeek(week.toObject()));
  }
}

function mapTrainingWeek(week: {
  _id: unknown;
  clubId: number;
  playerId: number;
  gameWeek: number;
  seasonWeek: number;
  date: Date;
  type: PersistedPlayerTrainingWeek["type"];
  kind: PersistedPlayerTrainingWeek["kind"];
  intensity: number;
  age: number;
  skills: Record<string, number | undefined>;
  skillsChange: Record<string, number | undefined>;
}): PersistedPlayerTrainingWeek {
  return {
    id: String(week._id),
    clubId: week.clubId,
    playerId: week.playerId,
    gameWeek: week.gameWeek,
    seasonWeek: week.seasonWeek,
    date: week.date,
    type: week.type,
    kind: week.kind,
    intensity: week.intensity,
    age: week.age,
    skills: week.skills,
    skillsChange: week.skillsChange
  };
}
