import { getServerPageContext } from "@/lib/server-page";
import { FinancesClientView } from "./FinancesClientView";

export default async function FinancesPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <FinancesClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
