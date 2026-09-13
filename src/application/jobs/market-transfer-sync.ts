import {
  acquireMarketTransferSyncRun,
  finishMarketTransferSyncRun,
  bulkUpsertMarketTransferCurrents,
  markMissingMarketTransferCurrent,
  getMissingMarketTransfers,
  cleanupStaleMarketTransferCurrents,
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
    console.warn(`[MarketTransferSync] Cannot acquire lock. Job already running or lease active.`);
    return { success: false, reason: "Job already running or lease active" };
  }

  console.log(`[MarketTransferSync] Started runId ${runId} (window: ${from.toISOString()} -> ${to.toISOString()})`);

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
    console.log(`[MarketTransferSync] Authenticating with Sokker provider...`);
    const provider: SokkerDataProvider = createSokkerDataProvider({ login, password });
    const currentContext = await provider.getCurrent();

    // 3. Process Active Transfers (Pagination)
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log(`[MarketTransferSync] Step 1: Fetching active transfers from Sokker market...`);

    while (hasMore) {
      const pageNum = counts.pagesRead + 1;
      const actives = await provider.getTransfers(limit, offset);
      if (actives.length === 0) {
        hasMore = false;
        break;
      }

      const transfersToUpsert = actives.map((t) => ({
        playerId: t.playerId,
        lastSeenAt: new Date(),
        deadline: new Date(t.deadline),
        status: "active" as const,
        lastSyncRunId: runId,
        player: {
          name: t.player.name,
          countryId: t.player.countryId,
          age: t.player.age,
          skills: t.player.skills as Record<string, number>
        }
      }));

      await bulkUpsertMarketTransferCurrents(transfersToUpsert);
      counts.currentUpserted += transfersToUpsert.length;
      counts.pagesRead++;
      console.log(`[MarketTransferSync] Page ${pageNum}: upserted ${actives.length} active transfers in bulk (Total: ${counts.currentUpserted})`);
      offset += limit;
    }

    // Step 2: Mark missing
    counts.currentMissing = await markMissingMarketTransferCurrent(runId);
    console.log(`[MarketTransferSync] Step 2: Completed active transfers scan. Marked ${counts.currentMissing} transfers as missing.`);

    // Purge stale missing transfers older than 7 days
    const cleanedStale = await cleanupStaleMarketTransferCurrents(7);
    if (cleanedStale > 0) {
      console.log(`[MarketTransferSync] Cleaned up ${cleanedStale} stale missing transfers older than 7 days.`);
    }

    // Step 3: Process Missing Currents whose deadline has actually passed (deadline <= now)
    const missingCurrents = await getMissingMarketTransfers(new Date());
    const totalMissing = missingCurrents.length;
    const concurrency = 15;
    console.log(`[MarketTransferSync] Step 3: Resolving ${totalMissing} expired missing transfers by checking individual player history (concurrency: ${concurrency})...`);

    let processedCount = 0;

    for (let i = 0; i < totalMissing; i += concurrency) {
      const chunk = missingCurrents.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (current) => {
          let wasPromoted = false;
          try {
            const history = await provider.getPlayerTransferHistory(current.playerId);
            const latest = history[0];

            if (latest) {
              const transferDate = new Date(latest.transferDate);
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
                wasPromoted = true;
              }
            }
          } catch (playerErr) {
            const msg = playerErr instanceof Error ? playerErr.message : String(playerErr);
            console.warn(`[MarketTransferSync] Failed to fetch transfer history for player ${current.playerId}: ${msg}`);
          }
          
          // promoteToFinalMarketTransfer already deletes the current record when promoted.
          // If not promoted (e.g. expired without sale), delete it here so it is not queried again.
          if (!wasPromoted) {
            await deleteMarketTransferCurrent(current.playerId);
          }
          counts.currentDeleted++;
          counts.pagesRead++;
        })
      );

      processedCount += chunk.length;

      if (processedCount % 50 === 0 || processedCount >= totalMissing) {
        const pct = totalMissing > 0 ? Math.round((processedCount / totalMissing) * 100) : 100;
        console.log(`[MarketTransferSync] Missing transfers progress: ${processedCount}/${totalMissing} (${pct}%) | Promoted: ${counts.finalCreatedOrUpdated}, Cleaned: ${counts.currentDeleted}`);
      }
    }

    await finishMarketTransferSyncRun(runId, counts);
    console.log(`[MarketTransferSync] Job completed successfully for runId ${runId}. Summary:`, counts);
    return { runId, success: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    let parsedReason: unknown = rawMsg;
    try {
      parsedReason = JSON.parse(rawMsg);
    } catch {
      // Keep as string if it's not valid JSON
    }
    
    console.error(`[MarketTransferSync] Job failed for runId ${runId}:`, rawMsg);
    await finishMarketTransferSyncRun(runId, counts, rawMsg);
    return { runId, success: false, reason: parsedReason };
  }
}

