export type MatchType = "OFFICIAL" | "FRIENDLY" | "NOT_ELIGIBLE";

export type MatchSide = "HOME" | "AWAY";

export type MatchFormation = "GK" | "DEF" | "MID" | "ATT";

export type MatchPlayerRole = "STARTER" | "SUBSTITUTE_USED" | "SUBSTITUTE_UNUSED";

export interface MatchPlayerAppearance {
  playerId: number;
  number: number;
  formation: MatchFormation;
  role: MatchPlayerRole;
  timeIn: number;
  timeOut: number;
  minutesPlayed: number;
}

export interface Match {
  id: number;
  clubId: number;
  gameWeek: number;
  week: number;
  playedAt: Date;
  leagueId: number;
  matchType: MatchType;
  side: MatchSide;
  opponent: {
    id: number;
    name: string;
  };
  score: {
    club: number;
    opponent: number;
  };
  players: MatchPlayerAppearance[];
}

export interface MatchPlayerParticipationInput {
  timeIn: number;
  timeOut: number;
  rating?: number | null;
  timePlaying?: number | null;
  timeDefending?: number | null;
}
