import {
  MongoClubRepository,
  MongoSnapshotRepository,
  type PersistedSnapshot
} from "@atlas/database";
import { generateBasicDiagnostic, type BasicDiagnostic } from "@atlas/domain";

import type { ClubId } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();

export async function getClubDiagnostic(clubId: ClubId): Promise<BasicDiagnostic | null> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error("Club not found: " + clubId);
  }

  const latestSnapshot = (await snapshotRepository.listByClub(clubId)).at(-1);

  return latestSnapshot ? createSnapshotDiagnostic(latestSnapshot, club.currency) : null;
}

export function createSnapshotDiagnostic(
  snapshot: PersistedSnapshot,
  currency: string | null
): BasicDiagnostic {
  return generateBasicDiagnostic(
    {
      id: snapshot.id,
      players: snapshot.players.map((player) => ({
        id: player.id,
        playerId: player.playerId,
        name: player.name,
        age: player.age,
        wage: { amount: player.wage, currency },
        value: { amount: player.value, currency },
        form: player.form,
        availabilityStatus: player.availabilityStatus,
        observedPosition: player.observedPosition,
        position: positionFromTraining(player.training.position),
        skills: player.skills
      }))
    },
    snapshot.importedAt
  );
}

function positionFromTraining(positionNum: number): string | null {
  switch (positionNum) {
    case 0: return "GK";
    case 1: return "DEF";
    case 2: return "MID";
    case 3: return "ATT";
    default: return null;
  }
}
