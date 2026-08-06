import { MongoClubRepository, type PersistedClub } from "@atlas/database";

export interface GetClubProfileInput {
  clubId: string;
}

const clubRepository = new MongoClubRepository();

export async function getClubProfile(input: GetClubProfileInput): Promise<PersistedClub> {
  const club = await clubRepository.findById(input.clubId);

  if (!club) {
    throw new Error(`Club not found: ${input.clubId}`);
  }

  return club;
}
