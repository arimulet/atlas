import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";
import type { HistoricalTrainingSkills, SokkerSyncValidationResult } from "./types.js";
import { loadSokkerSyncPayload } from "./sokker-sync-loader.js";
import { validateSokkerSyncPayload } from "./sokker-sync-validator.js";
import { isMongoConnected, MongoTrainingWeekRepository } from "@atlas/database";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;
const RETRY_WINDOW_MS = 5 * 60_000;

/** Every attempt reads a fresh snapshot. Persistence only receives the final valid result. */
export async function loadValidatedSokkerSyncPayload(
  provider: SokkerDataProvider
): Promise<SokkerSyncValidationResult> {
  const deadline = Date.now() + RETRY_WINDOW_MS;
  let lastResult: SokkerSyncValidationResult | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = await Promise.race([
        loadSokkerSyncPayload(provider, async (teamId, sourceWeekId) =>
          isMongoConnected()
            ? new MongoTrainingWeekRepository().getSkillsByWeek(teamId, sourceWeekId)
            : new Map<number, HistoricalTrainingSkills>()
        ),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Sokker import exceeded the five-minute retry window. No changes were saved; retry the complete import."
                )
              ),
            remaining
          );
        })
      ]);
      const result = validateSokkerSyncPayload(payload);
      if (result.status === "valid") return result;
      lastResult = {
        ...result,
        errors: result.errors.map((error) =>
          error.details
            ? {
                ...error,
                details: { ...error.details, attempt },
                message: `${error.message} Diagnostic: ${JSON.stringify({ ...error.details, attempt })}`
              }
            : error
        )
      };
      const shouldRetry = result.errors.some(
        (error) =>
          error.code.startsWith("SUMMARY_") ||
          error.code === "INVALID_SOURCE_TRAINING_REPORT" ||
          error.code === "UNEXPECTED_TRAINING_WEEK"
      );
      if (!shouldRetry || attempt === MAX_ATTEMPTS) return lastResult;
    } catch (error) {
      if (Date.now() >= deadline && lastResult) return lastResult;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (Date.now() + RETRY_DELAY_MS >= deadline) break;
    await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  if (lastResult) return lastResult;
  throw new Error(
    "Sokker import exceeded the five-minute retry window. No changes were saved; retry the complete import."
  );
}
