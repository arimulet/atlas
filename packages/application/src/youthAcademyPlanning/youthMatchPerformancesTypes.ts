export interface YouthPlayerMatchRating {
  rating: number;
  minutes: number;
}

export interface YouthMatchPerformancesDto {
  clubId: string;
  players: Record<string, YouthPlayerMatchPerformanceDto>;
}

export interface YouthPlayerMatchPerformanceDto {
  juniorId: number;
  calculatedPosition: "GK" | "DEF" | "MID" | "ATT" | null;
  gk: YouthPlayerMatchRating[];
  def: YouthPlayerMatchRating | null;
  mid: YouthPlayerMatchRating | null;
  att: YouthPlayerMatchRating | null;
}