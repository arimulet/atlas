import type {
  SokkerClubProfileDto,
  SokkerCountryDto,
  SokkerAuthResult,
  SokkerCredentials,
  SokkerImportResultDto,
  SokkerPlayerDto,
  SokkerTeamDto
} from "../../importer/types.js";

export type { SokkerAuthResult, SokkerCredentials };

export type ClubObservedProfile = SokkerClubProfileDto;
export type CountryReference = SokkerCountryDto;
export type XmlImportResult = SokkerImportResultDto;

export type SokkerCanonicalTeam = SokkerTeamDto;
export type SokkerCanonicalPlayer = SokkerPlayerDto;
