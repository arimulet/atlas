import { getServerPageContext } from "@/lib/server-page";
import { YouthClientView } from "./YouthClientView";

export default async function YouthPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <YouthClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
