import { getServerPageContext } from "@/lib/server-page";
import { PlayerDecisionsClientView } from "./PlayerDecisionsClientView";

export default async function PlayerDecisionsPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <PlayerDecisionsClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
