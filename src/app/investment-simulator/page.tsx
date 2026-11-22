import { getServerPageContext } from "@/lib/server-page";
import { InvestmentSimulatorClientView } from "./InvestmentSimulatorClientView";

export default async function InvestmentSimulatorPage() {
  const { serverUser, initialClub } = await getServerPageContext();

  return (
    <InvestmentSimulatorClientView
      initialServerUser={serverUser}
      initialClub={initialClub}
    />
  );
}
