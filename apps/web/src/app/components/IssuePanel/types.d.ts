import type { ImportIssue } from "../../types";

export interface IssuePanelProps {
  title: string;
  tone: "error" | "warning";
  issues: ImportIssue[];
}
