import type { DiagnosticFinding } from "@atlas/web/app/types";

export interface HeaderProps {
  diagnostics: DiagnosticFinding[];
  onOpenSokkerImporter: () => void;
}