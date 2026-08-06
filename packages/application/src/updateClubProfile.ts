import { MongoClubRepository, type PersistedClub } from "@atlas/database";

export interface UpdateClubProfileInput {
  clubId: string;
  manual: {
    name?: string | null;
    currency?: string | null;
    season?: number | null;
    week?: number | null;
    assumptions?: Array<{ key: string; value: string }>;
    preferences?: Array<{ key: string; value: string }>;
  };
}

const clubRepository = new MongoClubRepository();

export async function updateClubProfile(input: UpdateClubProfileInput): Promise<PersistedClub> {
  return clubRepository.updateManualProfile({
    clubId: input.clubId,
    ...input.manual
  });
}
