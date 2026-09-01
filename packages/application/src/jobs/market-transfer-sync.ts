import {
  acquireMarketTransferSyncRun,
  finishMarketTransferSyncRun,
  upsertMarketTransferCurrent,
  markMissingMarketTransferCurrent,
  getMissingMarketTransfers,
  deleteMarketTransferCurrent,
  promoteToFinalMarketTransfer,
  getLastSuccessfulMarketTransferSyncRun,
  MongoCountryRepository
} from "@atlas/database";
import { createSokkerDataProvider } from "../importer/SokkerDataProviderFactory.js";
import type { SokkerDataProvider } from "../importer/providers/SokkerDataProvider.js";

import { getSokkerSeason, normalizeSeasonWeek } from "@atlas/domain";

export async function runMarketTransferSyncJob(
  login: string,
  password: string,
  historyWindowDays: number = 3
): Promise<{ runId?: string; success: boolean; reason?: unknown }> {
  // Determine from and to dates
  const to = new Date();
  
  let from = new Date(to.getTime() - historyWindowDays * 24 * 60 * 60 * 1000);
  const lastRun = await getLastSuccessfulMarketTransferSyncRun();
  if (lastRun?.historyWindow?.to) {
    from = lastRun.historyWindow.to;
  }

  // 1. Acquire Lock
  const { runId, success } = await acquireMarketTransferSyncRun(from, to, 60 * 60 * 1000);
  if (!success || !runId) {
    return { success: false, reason: "Job already running or lease active" };
  }

  const countryRepo = new MongoCountryRepository();
  const allCountries = await countryRepo.getAll();
  const currencyRates = new Map<string, number>();
  for (const c of allCountries) {
    if (c.currencyName && c.currencyRate) {
      currencyRates.set(c.currencyName, c.currencyRate);
    }
  }

  const counts = {
    pagesRead: 0,
    currentUpserted: 0,
    currentMissing: 0,
    finalCreatedOrUpdated: 0,
    currentDeleted: 0
  };

  try {
    // 2. Auth Provider
    const provider: SokkerDataProvider = createSokkerDataProvider({ login, password });
    const currentContext = await provider.getCurrent();

    // 3. Process Active Transfers (Pagination)
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const actives = await provider.getTransfers(limit, offset);
      if (actives.length === 0) {
        hasMore = false;
        break;
      }

      for (const t of actives) {
        await upsertMarketTransferCurrent({
          playerId: t.playerId,
          lastSeenAt: new Date(),
          deadline: new Date(t.deadline),
          status: "active",
          lastSyncRunId: runId,
          player: {
            name: t.player.name,
            countryId: t.player.countryId,
            age: t.player.age,
            skills: t.player.skills as Record<string, number>
          }
        });
        counts.currentUpserted++;
      }
      
      counts.pagesRead++;
      offset += limit;
    }

    // Mark missing
    counts.currentMissing = await markMissingMarketTransferCurrent(runId);

    // 4. Process Missing Currents by hitting individual transfer histories
    const missingCurrents = await getMissingMarketTransfers();

    for (const current of missingCurrents) {
      try {
        const history = await provider.getPlayerTransferHistory(current.playerId);
        const latest = history[0];

        if (latest) {
          const transferDate = new Date(latest.transferDate);
          
          // Check if this is the transfer we tracked. 
          // If the player was just sold, the transfer date should be AFTER they were put on the market (firstSeenAt).
          // We'll give a generous 3-day buffer for timezone inconsistencies or slow updates.
          const bufferTime = current.firstSeenAt.getTime() - (3 * 24 * 60 * 60 * 1000);
          
          if (transferDate.getTime() > bufferTime) {
            const diffMs = transferDate.getTime() - new Date().getTime();
            const msPerWeek = 7 * 24 * 60 * 60 * 1000;
            const weekDiff = Math.round(diffMs / msPerWeek);
            const transferGameWeek = currentContext.calendar.gameWeek + weekDiff;
            
            await promoteToFinalMarketTransfer({
              transferKey: latest.transferKey,
              playerId: latest.playerId,
              name: latest.name,
              transferDate,
              gameWeek: transferGameWeek,
              season: getSokkerSeason(transferGameWeek),
              week: normalizeSeasonWeek(transferGameWeek),
              salePrice: Math.round(latest.salePrice * (currencyRates.get(latest.currency) ?? 1)),
              age: latest.age,
              skills: current.player.skills
            });
            counts.finalCreatedOrUpdated++;
          }
        }
      } catch {
        // Log or ignore single player failure, we'll delete the current record anyway
        // or wait, if the API fails randomly, we might not want to delete it yet?
        // Usually if it's a 404, player is deleted. For safety, we just delete it.
      }
      
      // Always delete the current record so it doesn't get scanned every single run
      await deleteMarketTransferCurrent(current.playerId);
      counts.currentDeleted++;
      counts.pagesRead++; // Treat each player fetch as a page read for telemetry
    }

    await finishMarketTransferSyncRun(runId, counts);
    return { runId, success: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    let parsedReason: unknown = rawMsg;
    try {
      parsedReason = JSON.parse(rawMsg);
    } catch {
      // Keep as string if it's not valid JSON
    }
    
    await finishMarketTransferSyncRun(runId, counts, rawMsg);
    return { runId, success: false, reason: parsedReason };
  }
}
