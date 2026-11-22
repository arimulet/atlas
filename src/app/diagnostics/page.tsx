import { getServerPageContext } from "@/lib/server-page";
import { DiagnosticsClientView } from "./DiagnosticsClientView";

export default async function DiagnosticsPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <DiagnosticsClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
