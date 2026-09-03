import {
  MongoClubRepository,
  MongoSnapshotRepository,
  MongoCountryRepository,
  findFinalMarketTransfersUpToDate,
  type PersistedSnapshot,
  type PersistedMarketTransfer
} from "@atlas/database";
import { 
  generateBasicDiagnostic, 
  type BasicDiagnostic,
  calibratePlayerMarketValue,
  type PlayerTransferRecord
} from "@atlas/domain";

import type { ClubId } from "../types.js";

const clubRepository = new MongoClubRepository();
const snapshotRepository = new MongoSnapshotRepository();
const countryRepository = new MongoCountryRepository();

export async function getClubDiagnostic(clubId: ClubId): Promise<BasicDiagnostic | null> {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error("Club not found: " + clubId);
  }

  const latestSnapshot = (await snapshotRepository.listByClub(clubId)).at(-1);
  if (!latestSnapshot) return null;

  const clubCountry = await countryRepository.getById(club.country);
  const currencyRate = clubCountry?.currencyRate ?? 1;
  const currencyName = clubCountry?.currencyName ?? club.currency;

  const rawTransfers = await findFinalMarketTransfersUpToDate(new Date());
  const mappedTransfers = rawTransfers.map(t => mapMarketTransferToRecord(t, currencyName, currencyRate));

  return createSnapshotDiagnostic(latestSnapshot, club.currency, mappedTransfers);
}

export function createSnapshotDiagnostic(
  snapshot: PersistedSnapshot,
  currency: string | null,
  transfers: PlayerTransferRecord[] = []
): BasicDiagnostic {
  return generateBasicDiagnostic(
    {
      id: snapshot.id,
      players: snapshot.players.map((player) => {
        let calibratedValue: number | null = null;
        
        if (player.age >= 30 && player.playerId) {
           const context = {
             player: {
               playerId: player.playerId,
               age: player.age,
               skills: player.skills
             }
           };
           const calibration = calibratePlayerMarketValue(context, transfers);
           // Only use it if we found actual comparable transfers on the market
            if (calibration.comparableEstimate) {
              calibratedValue = calibration.calibratedValue.expected;
           }
        }

        return {
          id: player.id,
          playerId: player.playerId,
          name: player.name,
          age: player.age,
          wage: { amount: player.wage, currency },
          value: { amount: player.value, currency },
          calibratedValue: calibratedValue ? { amount: calibratedValue, currency } : null,
          form: player.form,
          availabilityStatus: player.availabilityStatus,
          observedPosition: player.observedPosition,
          position: positionFromTraining(player.training.position),
          skills: player.skills
        };
      })
    },
    snapshot.importedAt
  );
}

function mapMarketTransferToRecord(
  transfer: PersistedMarketTransfer,
  currencyName: string,
  currencyRate: number
): PlayerTransferRecord {
  return {
    transferId: transfer.transferKey,
    playerId: transfer.playerId,
    transferDate: transfer.transferDate,
    gameWeek: transfer.gameWeek,
    salePrice: Math.round(transfer.salePrice / currencyRate),
    currency: currencyName,
    age: transfer.age,
    skills: {
      stamina: transfer.skills.stamina ?? null,
      pace: transfer.skills.pace ?? null,
      technique: transfer.skills.technique ?? null,
      passing: transfer.skills.passing ?? null,
      keeper: transfer.skills.keeper ?? null,
      defender: transfer.skills.defender ?? null,
      playmaker: transfer.skills.playmaker ?? null,
      striker: transfer.skills.striker ?? null
    },
    source: "imported",
    salePriceType: "final_sale"
  };
}

function positionFromTraining(positionNum: number): string | null {
  switch (positionNum) {
    case 0: return "GK";
    case 1: return "DEF";
    case 2: return "MID";
    case 3: return "ATT";
    default: return null;
  }
}

