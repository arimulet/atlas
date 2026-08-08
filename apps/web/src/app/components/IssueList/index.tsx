import { IssueListProps } from "./types";

export const IssueList = ({ issues }: IssueListProps) => (
  <ul className="issue-list">
    {issues.map((issue) => (
      <li key={`${issue.code}-${issue.message}`}>
        <code>{issue.code}</code>
        <span>{issue.message}</span>
      </li>
    ))}
  </ul>
);
