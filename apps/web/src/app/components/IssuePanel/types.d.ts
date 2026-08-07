import type { ImportIssue } from "@atlas/web/app/types";

export interface IssuePanelProps {
  title: string;
  tone: "error" | "warning";
  issues: ImportIssue[];
}
