import type { PlayerSnapshotV0 } from "@atlas/contracts";

import type { Money } from "../../types.js";

export interface SokkerCredentials {
  login: string;
  password: string;
}

export interface SokkerAuthResult {
  sessionId: string;
  teamId: string;
}

export interface ClubObservedProfile {
  externalId: string;
  name: string;
  countryId: number;
  money: Money;
  season?: number;
  gameWeek: number;
  week: number;
  training?: {
    gk: number | null;
    def: number | null;
    mid: number | null;
    att: number | null;
  } | null;
}

export interface CountryReference {
  id: number;
  name: string;
  currencyName: string;
  currencyRate: number;
}

export interface XmlImportResult {
  clubProfile: ClubObservedProfile;
  players: PlayerSnapshotV0["players"];
  juniors: NonNullable<PlayerSnapshotV0["juniors"]>;
  source: string;
  importedAt: Date;
  countries: CountryReference[];
}
