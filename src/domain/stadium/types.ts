export type StandLocation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type StandLocationCode = "N" | "S" | "W" | "E" | "NW" | "NE" | "SW" | "SE";

export type StandType = 1 | 2 | 3; // 1: Terraces, 2: Benches, 3: Seats

export interface StadiumStand {
  location: StandLocation;
  type: StandType;
  size: number;
  roof: boolean;
  ticketPrice?: {
    currency: string;
    value: number;
  };
  inConstruction?: boolean;
  constructionDays?: number;
}

export interface PitchData {
  length: number; // in meters, e.g. 95 - 110
  width: number;  // in meters, e.g. 64 - 78
  mow: number;    // mowing pattern index (1..5)
  condition: number; // percentage 0..100
  grassType?: number;
  maintenance?: number;
  logo?: {
    size: number;
    x: number;
    y: number;
  };
}

export interface StadiumData {
  name: string;
  seats: number;
  seatsInProgress: number;
  weather?: number; // Sokker weather id (e.g. 37: rain)
  pitch: PitchData;
  stands: StadiumStand[];
}

export const STAND_LOCATION_INFO: Record<
  StandLocation,
  { code: StandLocationCode; label: string; isCorner: boolean }
> = {
  1: { code: "N", label: "Tribuna Norte", isCorner: false },
  2: { code: "S", label: "Tribuna Sur", isCorner: false },
  3: { code: "W", label: "Tribuna Oeste", isCorner: false },
  4: { code: "E", label: "Tribuna Este", isCorner: false },
  5: { code: "NW", label: "Codo Noroeste", isCorner: true },
  6: { code: "NE", label: "Codo Noreste", isCorner: true },
  7: { code: "SW", label: "Codo Suroeste", isCorner: true },
  8: { code: "SE", label: "Codo Sureste", isCorner: true }
};

export const STAND_TYPE_LABELS: Record<StandType, string> = {
  1: "Populares (De pie)",
  2: "Gradas (Bancos)",
  3: "Butacas (Asientos)"
};
