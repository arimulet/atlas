import { getServerPageContext } from "@/lib/server-page";
import { StadiumClientView } from "./StadiumClientView";

export default async function StadiumPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <StadiumClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
