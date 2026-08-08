export interface IssueListProps {
    issues: IssueListItem[]
}

export type IssueListItem = {
    code: string;
    message: string;
}