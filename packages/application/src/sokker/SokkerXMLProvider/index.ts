import { SokkerXmlProvider } from "../../importer/providers/xml/SokkerXmlProvider.js";
import type { SokkerCredentials } from "../../importer/types.js";
import type { XmlImportResult } from "./types.js";

export { SokkerXmlProvider } from "../../importer/providers/xml/SokkerXmlProvider.js";

export class SokkerXMLProvider extends SokkerXmlProvider {
  constructor(credentials: SokkerCredentials) {
    super(credentials);
  }

  async importFullTeamData(): Promise<XmlImportResult> {
    return this.getFullTeamData();
  }
}
export type {
  ClubObservedProfile,
  CountryReference,
  SokkerAuthResult,
  SokkerCredentials,
  XmlImportResult
} from "./types.js";
export { normalizeSeasonWeek } from "@atlas/domain";
