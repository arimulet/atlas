import { Section } from "../Section";
import { IssuePanelProps } from "./types";

export const IssuePanel = ({ title, tone, issues }: IssuePanelProps) => {
  return (
    <Section
      className={`issue-panel ${tone}`}
      title={tone === "error" ? "Import Errors" : "Import Warnings"}
      subtitle={title}
    >
      <ul className="issue-list">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.message}`}>
            <code>{issue.path}</code>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
};
