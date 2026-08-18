import { SokkerJsonApiProvider } from "./providers/api/SokkerJsonApiProvider.js";
import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";
import type { SokkerCredentials } from "./types.js";

export function createSokkerDataProvider(credentials: SokkerCredentials): SokkerDataProvider {
  return new SokkerJsonApiProvider(credentials);
}
