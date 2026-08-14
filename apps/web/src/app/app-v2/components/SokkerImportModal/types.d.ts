import type { SokkerImporterFormProps } from "../SokkerImporterForm/types";

export interface SokkerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: SokkerImporterFormProps["onImport"];
}
