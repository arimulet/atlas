import { getServerPageContext } from "@/lib/server-page";
import { SquadClientView } from "./SquadClientView";

export default async function SquadPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <SquadClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
