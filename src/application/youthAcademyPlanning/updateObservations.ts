import { ClubId } from "../types.js";
import { MongoJuniorRepository, MongoClubRepository } from "@atlas/database";

const juniorRepository = new MongoJuniorRepository();
const clubRepository = new MongoClubRepository();

export async function updateYouthObservations(
  clubId: ClubId,
  playerId: number,
  observations: string
): Promise<void> {
  const club = await clubRepository.findById(clubId.toString());
  if (!club) throw new Error("Club not found");

  await juniorRepository.updateObservations(club.clubId, playerId, observations);
}
