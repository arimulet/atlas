import { getServerPageContext } from "@/lib/server-page";
import { YouthPerformancesClientView } from "./YouthPerformancesClientView";

export default async function YouthPerformancesPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <YouthPerformancesClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
