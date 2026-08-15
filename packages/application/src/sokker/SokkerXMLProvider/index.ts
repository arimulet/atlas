export { SokkerXmlProvider } from "../../importer/providers/xml/SokkerXmlProvider.js";
import { SokkerXmlProvider } from "../../importer/providers/xml/SokkerXmlProvider.js";
import type { SokkerCredentials } from "../../importer/types.js";
import type { XmlImportResult } from "./types.js";

export class SokkerXMLProvider extends SokkerXmlProvider {
  async importFullTeamData(credentials: SokkerCredentials): Promise<XmlImportResult> {
    await this.login(credentials);

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
