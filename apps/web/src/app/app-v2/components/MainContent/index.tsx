import { MainContentProps } from "./types";

export function MainContent({ children }: MainContentProps) {
  return <main className="v2-main-content">{children}</main>;
}
