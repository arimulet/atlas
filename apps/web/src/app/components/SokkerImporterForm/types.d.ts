import type { ImportResponse } from "@atlas/web/app/types";

export interface SokkerImportCredentials {
  login: string;
  password: string;
}

export interface SokkerImporterFormProps {
  onCancel: () => void;
  onImport: (credentials: SokkerImportCredentials) => Promise<ImportResponse>;
  onLoadingChange?: (isLoading: boolean) => void;
}
