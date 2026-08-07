import { DiagnosticFinding } from "../../types";

export interface DiagnosticPanelProps {
  findingsByCategory: Array<[string, DiagnosticFinding[]]>;
}