import { IssuePanelProps } from "./types";

export const IssuePanel = ({ title, tone, issues }: IssuePanelProps) => {
  return (
    <section className={`panel issue-panel ${tone}`}>
      <div className="panel-heading">
        <p className="eyebrow">{tone === "error" ? "Import Errors" : "Import Warnings"}</p>
        <h2>{title}</h2>
      </div>
      <ul className="issue-list">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.message}`}>
            <code>{issue.path}</code>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
