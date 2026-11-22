import { getServerPageContext } from "@/lib/server-page";
import { PlayerDetailClientView } from "./PlayerDetailClientView";

export default async function PlayerDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <PlayerDetailClientView
      id={id}
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
