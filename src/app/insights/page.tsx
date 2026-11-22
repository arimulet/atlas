import { getServerPageContext } from "@/lib/server-page";
import { InsightsClientView } from "./InsightsClientView";

export default async function InsightsPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <InsightsClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
