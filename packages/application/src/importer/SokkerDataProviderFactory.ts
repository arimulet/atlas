import { SokkerApiClient } from "./providers/api/SokkerApiClient.js";
import { SokkerJsonApiProvider } from "./providers/api/SokkerJsonApiProvider.js";
import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";
import { SokkerXmlProvider } from "./providers/xml/SokkerXmlProvider.js";
import type { SokkerCredentials, SokkerDataSource } from "./types.js";

export interface CreateSokkerDataProviderInput {
  source: SokkerDataSource;
  credentials: SokkerCredentials;
}

export function createSokkerDataProvider(
  input: CreateSokkerDataProviderInput
): SokkerDataProvider {
  if (input.source === "xml") {
    return new SokkerXmlProvider(input.credentials);
  }

  return new SokkerJsonApiProvider(
    input.credentials,
    new SokkerApiClient({ credentials: input.credentials })
  );
}
