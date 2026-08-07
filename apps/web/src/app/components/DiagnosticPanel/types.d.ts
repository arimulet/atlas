import { DiagnosticFinding } from "@atlas/web/app/types";

export interface DiagnosticPanelProps {
  findingsByCategory: Array<[string, DiagnosticFinding[]]>;
}