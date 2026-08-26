import { PlayerTransferModel } from "../models/playerTransfer.js";
import type { PersistedPlayerTransfer, SavePlayerTransferInput } from "./types.js";

export class MongoPlayerTransferRepository {
  async save(input: SavePlayerTransferInput): Promise<PersistedPlayerTransfer> {
    const key = buildTransferKey(input);
    const transfer = await PlayerTransferModel.findOneAndUpdate(
      { transferKey: key },
      {
        $set: {
          transferKey: key,
          transferId: input.transferId ?? null,
          playerId: input.playerId ?? null,
          transferDate: input.transferDate,
          gameWeek: input.gameWeek ?? null,
          salePrice: input.salePrice,
          currency: input.currency ?? null,
          normalizedSalePrice: input.normalizedSalePrice ?? null,
          age: input.age,
          skills: input.skills,
          formation: input.formation ?? null,
          developmentProfile: input.developmentProfile ?? null,
          sokkerValue: input.sokkerValue ?? null,
          source: input.source,
          dataQuality: input.dataQuality ?? null,
          salePriceType: input.salePriceType ?? "unknown"
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (!transfer) throw new Error(`Player transfer could not be persisted: ${key}.`);
    return mapTransfer(transfer.toObject() as unknown as PlayerTransferDocumentShape);
  }

  async findTransfersForCalibration(input: {
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}): Promise<PersistedPlayerTransfer[]> {
    const query: Record<string, unknown> = {};
    if (input.fromDate || input.toDate) {
      query.transferDate = {
        ...(input.fromDate ? { $gte: input.fromDate } : {}),
        ...(input.toDate ? { $lte: input.toDate } : {})
      };
    }
    let transfers = PlayerTransferModel.find(query).sort({ transferDate: 1, transferKey: 1 });
    if (input.limit !== undefined) transfers = transfers.limit(input.limit);
    const documents = await transfers;
    return documents.map((transfer) => mapTransfer(transfer.toObject() as unknown as PlayerTransferDocumentShape));
  }

  async findTransfersBefore(date: Date): Promise<PersistedPlayerTransfer[]> {
    const transfers = await PlayerTransferModel.find({ transferDate: { $lt: date } }).sort({
      transferDate: 1,
      transferKey: 1
    });
    return transfers.map((transfer) => mapTransfer(transfer.toObject() as unknown as PlayerTransferDocumentShape));
  }
}

interface PlayerTransferDocumentShape {
  _id: { toString(): string };
  transferKey: string;
  transferId?: string | null;
  playerId?: number | null;
  transferDate: Date;
  gameWeek?: number | null;
  salePrice: number;
  currency?: string | null;
  normalizedSalePrice?: number | null;
  age: number;
  skills: PersistedPlayerTransfer["skills"];
  formation?: PersistedPlayerTransfer["formation"];
  developmentProfile?: PersistedPlayerTransfer["developmentProfile"];
  sokkerValue?: number | null;
  source: PersistedPlayerTransfer["source"];
  dataQuality?: PersistedPlayerTransfer["dataQuality"];
  salePriceType?: PersistedPlayerTransfer["salePriceType"];
}

function buildTransferKey(input: SavePlayerTransferInput): string {
  if (input.transferId) return `id:${input.transferId}`;
  return `player:${input.playerId ?? "unknown"}|date:${input.transferDate.toISOString()}|price:${input.salePrice}`;
}

function mapTransfer(document: PlayerTransferDocumentShape): PersistedPlayerTransfer {
  return {
    id: document._id.toString(),
    transferKey: document.transferKey,
    ...(document.transferId ? { transferId: document.transferId } : {}),
    ...(document.playerId === null || document.playerId === undefined
      ? {}
      : { playerId: document.playerId }),
    transferDate: document.transferDate,
    gameWeek: document.gameWeek ?? null,
    salePrice: document.salePrice,
    currency: document.currency ?? null,
    normalizedSalePrice: document.normalizedSalePrice ?? null,
    age: document.age,
    skills: document.skills,
    formation: document.formation ?? null,
    developmentProfile: document.developmentProfile ?? null,
    sokkerValue: document.sokkerValue ?? null,
    source: document.source,
    dataQuality: document.dataQuality ?? undefined,
    salePriceType: document.salePriceType ?? "unknown"
  };
}
