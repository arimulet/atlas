import { Types } from "mongoose";
import { getSquadRoleAssignmentModel } from "../models/squadRoleAssignment.js";
import type { PersistedSquadRoleAssignment, SaveSquadRoleAssignmentInput } from "./types.js";

export class MongoSquadRoleAssignmentRepository {
  async findByPlayerId(input: {
    playerId: number;
    clubId: number;
  }): Promise<PersistedSquadRoleAssignment | null> {
    const assignment = await getSquadRoleAssignmentModel().findOne(input);
    return assignment ? mapAssignment(assignment) : null;
  }

  async listByClub(clubId: number): Promise<PersistedSquadRoleAssignment[]> {
    const assignments = await getSquadRoleAssignmentModel().find({ clubId }).sort({ playerId: 1 });
    return assignments.map(mapAssignment);
  }

  async saveManualOverride(
    input: SaveSquadRoleAssignmentInput
  ): Promise<PersistedSquadRoleAssignment> {
    const assignment = await getSquadRoleAssignmentModel().findOneAndUpdate(
      { playerId: input.playerId, clubId: input.clubId },
      {
        $set: { role: input.role },
        $setOnInsert: { playerId: input.playerId, clubId: input.clubId }
      },
      { new: true, upsert: true, runValidators: true }
    );

    return mapAssignment(assignment);
  }

  async deleteManualOverride(input: { playerId: number; clubId: number }): Promise<void> {
    await getSquadRoleAssignmentModel().deleteOne(input);
  }
}

function mapAssignment(assignment: {
  _id: Types.ObjectId;
  playerId: number;
  clubId: number;
  role: PersistedSquadRoleAssignment["role"];
}): PersistedSquadRoleAssignment {
  return {
    id: assignment._id.toString(),
    playerId: assignment.playerId,
    clubId: assignment.clubId,
    role: assignment.role,
    source: "manual"
  };
}
