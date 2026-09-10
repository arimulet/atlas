import { Types } from "mongoose";
import { ClubModel } from "../models/club.js";

export interface ClubProfileMigrationResult {
  migrated: number;
}

export async function migrateClubProfileDocuments(): Promise<ClubProfileMigrationResult> {
  const documents = await ClubModel.collection
    .find({
      $or: [
        { "budget.value": { $type: "number" } },
        { "settings.currency": { $exists: true } },
        { currency: { $exists: false } }
      ]
    })
    .toArray();

  let migrated = 0;

  for (const document of documents) {
    const legacyBudget = asRecord(document.budget);
    const legacySettings = asRecord(document.settings);
    const legacyCurrency = asRecord(legacySettings?.currency);
    const update: Record<string, unknown> = {};

    if (typeof legacyBudget?.value === "number" && Number.isFinite(legacyBudget.value)) {
      update.budget = legacyBudget.value;
    }

    if (typeof document.currency !== "string" && typeof legacyCurrency?.name === "string") {
      update.currency = legacyCurrency.name;
    }

    const hasLegacySettingsCurrency = legacyCurrency !== null;
    const hasLegacyBudgetCurrency = legacyBudget !== null && "currency" in legacyBudget;
    if (
      Object.keys(update).length === 0 &&
      !hasLegacySettingsCurrency &&
      !hasLegacyBudgetCurrency
    ) {
      continue;
    }

    const $unset: Record<string, string> = { "settings.currency": "" };
    if (!("budget" in update)) {
      $unset["budget.currency"] = "";
    }

    await ClubModel.collection.updateOne(
      { _id: document._id as Types.ObjectId },
      {
        $set: update,
        $unset
      }
    );
    migrated += 1;
  }

  return { migrated };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
