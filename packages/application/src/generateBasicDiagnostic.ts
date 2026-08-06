import {
  generateBasicDiagnostic,
  type BasicDiagnostic,
  type BasicDiagnosticPlayerSnapshot
} from "@atlas/domain";
import { MongoSnapshotRepository, type PersistedPlayerSnapshot } from "@atlas/database";

export interface GenerateBasicDiagnosticInput {
  snapshotId: string;
  generatedAt?: Date;
}

const snapshotRepository = new MongoSnapshotRepository();

export async function generateBasicDiagnosticForSnapshot(
  input: GenerateBasicDiagnosticInput
): Promise<BasicDiagnostic> {
  const snapshot = await snapshotRepository.findById(input.snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${input.snapshotId}`);
  }

  return generateBasicDiagnostic(
    {
      id: snapshot.id,
      players: snapshot.players.map(mapPlayerSnapshot)
    },
    input.generatedAt
  );
}

function mapPlayerSnapshot(player: PersistedPlayerSnapshot): BasicDiagnosticPlayerSnapshot {
  return {
    id: player.id,
    playerId: player.playerId,
    externalId: player.externalId,
    name: player.name,
    age: player.age,
    wage: player.wage,
    estimatedValue: player.estimatedValue,
    form: player.form,
    availabilityStatus: player.availabilityStatus,
    observedPosition: player.observedPosition,
    skills: player.skills
  };
}
