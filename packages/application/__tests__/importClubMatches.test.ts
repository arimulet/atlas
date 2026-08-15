import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importClubMatches,
  normalizeMatchForClub,
  type MatchRepository,
  type SokkerMatchesXmlClient
} from "@atlas/application";
import type { PersistedMatch, SaveMatchInput } from "@atlas/database";

const CLUB_ID = 6038;

describe("ImportClubMatches", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ignores unfinished matches, imports finished matches and caches the league", async () => {
    const saved: SaveMatchInput[] = [];
    const mockXmlClient = buildMockXmlClient();
    const mockMatchRepository = buildMockMatchRepository(saved);

    const result = await importClubMatches(
      { clubId: CLUB_ID, credentials: { login: "user", password: "password" } },
      { xmlClient: mockXmlClient, matchRepository: mockMatchRepository }
    );

    expect(result).toEqual({ discovered: 3, finished: 2, imported: 2, skipped: 0, failed: 0 });
    expect(saved).toHaveLength(2);
    expect(mockXmlClient.fetchXml).toHaveBeenCalledWith("match-44421295.xml", "session");
    expect(mockXmlClient.fetchXml).toHaveBeenCalledWith("match-44421296.xml", "session");
    expect(
      mockXmlClient.fetchXml.mock.calls.filter(([filename]) => filename === "league-1295.xml")
    ).toHaveLength(1);
  });

  it("does not download or persist an already imported match", async () => {
    const saved: SaveMatchInput[] = [];
    const mockXmlClient = buildMockXmlClient();
    const mockMatchRepository = buildMockMatchRepository(saved);
    const input = { clubId: CLUB_ID, credentials: { login: "user", password: "password" } };

    const firstResult = await importClubMatches(input, {
      xmlClient: mockXmlClient,
      matchRepository: mockMatchRepository
    });
    const secondResult = await importClubMatches(input, {
      xmlClient: mockXmlClient,
      matchRepository: mockMatchRepository
    });

    expect(firstResult.imported).toBe(2);
    expect(secondResult).toMatchObject({
      discovered: 3,
      finished: 2,
      imported: 0,
      skipped: 2,
      failed: 0
    });
    expect(saved).toHaveLength(2);
    expect(
      mockXmlClient.fetchXml.mock.calls
        .filter(([filename]) => filename.startsWith("match-"))
        .map(([filename]) => filename)
    ).toEqual(["match-44421295.xml", "match-44421296.xml"]);
  });

  it("normalizes the owner as home", () => {
    const match = normalizeMatchForClub(
      CLUB_ID,
      {
        id: 1,
        homeTeamId: CLUB_ID,
        awayTeamId: 78183,
        homeTeamName: "River Plate Forever",
        awayTeamName: "Flynet Football Club",
        leagueId: 1295,
        gameWeek: 1204,
        playedAt: new Date("2026-08-14T23:29:00.000Z"),
        homeScore: 1,
        awayScore: 5,
        isFinished: true
      },
      { id: 1295, name: "Friendly", type: 4, isOfficial: false },
      []
    );

    expect(match).toMatchObject({
      side: "HOME",
      opponent: { id: 78183, name: "Flynet Football Club" },
      score: { club: 1, opponent: 5 },
      gameWeek: 1204,
      week: 7
    });
  });

  it("normalizes the owner as away", () => {
    const match = normalizeMatchForClub(
      CLUB_ID,
      {
        id: 2,
        homeTeamId: 118160,
        awayTeamId: CLUB_ID,
        homeTeamName: "Batacazo FC",
        awayTeamName: "River Plate Forever",
        leagueId: 1295,
        gameWeek: 1204,
        playedAt: new Date("2026-08-14T23:29:00.000Z"),
        homeScore: 2,
        awayScore: 0,
        isFinished: true
      },
      { id: 1295, name: "League", type: 1, isOfficial: true },
      []
    );

    expect(match).toMatchObject({
      side: "AWAY",
      opponent: { id: 118160, name: "Batacazo FC" },
      score: { club: 0, opponent: 2 },
      matchType: "OFFICIAL"
    });
  });

  it("normalizes player formation, role and minutes from player stats", async () => {
    const saved: SaveMatchInput[] = [];
    const mockXmlClient = buildMockXmlClient();
    const mockMatchRepository = buildMockMatchRepository(saved);

    await importClubMatches(
      { clubId: CLUB_ID, credentials: { login: "user", password: "password" } },
      { xmlClient: mockXmlClient, matchRepository: mockMatchRepository }
    );

    expect(saved[0]?.players).toEqual([
      expect.objectContaining({ formation: "GK", role: "STARTER", minutesPlayed: 90 }),
      expect.objectContaining({ formation: "DEF", role: "STARTER", minutesPlayed: 60 }),
      expect.objectContaining({ formation: "MID", role: "SUBSTITUTE_USED", minutesPlayed: 30 }),
      expect.objectContaining({ formation: "ATT", role: "SUBSTITUTE_UNUSED", minutesPlayed: 0 })
    ]);
  });
});

function buildMockXmlClient(): SokkerMatchesXmlClient & {
  fetchXml: ReturnType<typeof vi.fn>;
} {
  const xmlByFilename: Record<string, string> = {
    [`matches-team-${CLUB_ID}.xml`]: `
      <matches teamID="${CLUB_ID}">
        <match><matchID>44421295</matchID><homeTeamID>${CLUB_ID}</homeTeamID><awayTeamID>78183</awayTeamID><homeTeamName>River Plate Forever</homeTeamName><awayTeamName>Flynet Football Club</awayTeamName><leagueID>1295</leagueID><week>1204</week><dateExpected>2026-08-14 23:29</dateExpected><dateStarted>2026-08-14 23:29</dateStarted><homeTeamScore>1</homeTeamScore><awayTeamScore>5</awayTeamScore><isFinished>1</isFinished></match>
        <match><matchID>44421296</matchID><homeTeamID>118160</homeTeamID><awayTeamID>${CLUB_ID}</awayTeamID><homeTeamName>Batacazo FC</homeTeamName><awayTeamName>River Plate Forever</awayTeamName><leagueID>1295</leagueID><week>1204</week><dateExpected>2026-08-15 23:29</dateExpected><dateStarted>2026-08-15 23:29</dateStarted><homeTeamScore>2</homeTeamScore><awayTeamScore>0</awayTeamScore><isFinished>1</isFinished></match>
        <match><matchID>44421297</matchID><homeTeamID>${CLUB_ID}</homeTeamID><awayTeamID>78183</awayTeamID><homeTeamName>River Plate Forever</homeTeamName><awayTeamName>Flynet Football Club</awayTeamName><leagueID>1295</leagueID><week>1205</week><dateExpected>0000-00-00 00:00</dateExpected><dateStarted>0000-00-00 00:00</dateStarted><homeTeamScore>0</homeTeamScore><awayTeamScore>0</awayTeamScore><isFinished>0</isFinished></match>
      </matches>`,
    "match-44421295.xml": `<match><playersStats teamID="${CLUB_ID}"><playerStats><playerID>1</playerID><number>1</number><formation>0</formation><timeIn>0</timeIn><timeOut>0</timeOut><rating>62</rating><timePlaying>2413</timePlaying><timeDefending>1039</timeDefending></playerStats><playerStats><playerID>2</playerID><number>2</number><formation>1</formation><timeIn>0</timeIn><timeOut>60</timeOut><rating>50</rating><timePlaying>2000</timePlaying><timeDefending>1000</timeDefending></playerStats><playerStats><playerID>3</playerID><number>12</number><formation>2</formation><timeIn>60</timeIn><timeOut>0</timeOut><rating>40</rating><timePlaying>1000</timePlaying><timeDefending>500</timeDefending></playerStats><playerStats><playerID>4</playerID><number>15</number><formation>3</formation><timeIn>0</timeIn><timeOut>0</timeOut><rating>0</rating><timePlaying>0</timePlaying><timeDefending>0</timeDefending></playerStats></playersStats></match>`,
    "match-44421296.xml": `<match><playersStats teamID="${CLUB_ID}"><playerStats><playerID>5</playerID><number>1</number><formation>0</formation><timeIn>0</timeIn><timeOut>0</timeOut><rating>60</rating></playerStats></playersStats></match>`,
    "league-1295.xml": `<league><info><leagueID>1295</leagueID><name>Friendly</name><countryID>0</countryID><division>0</division><round>0</round><season>0</season><type>4</type><isOfficial>0</isOfficial><isCup>0</isCup></info></league>`
  };
  const fetchXml = vi.fn(async (filename: string) => {
    const xml = xmlByFilename[filename];
    if (!xml) {
      throw new Error(`Missing fixture ${filename}`);
    }
    return xml;
  });

  return {
    login: vi.fn().mockResolvedValue({ sessionId: "session", teamId: String(CLUB_ID) }),
    fetchXml
  };
}

function buildMockMatchRepository(saved: SaveMatchInput[]): MatchRepository {
  const importedIds = new Set<number>();

  return {
    exists: vi.fn(async (matchId: number) => importedIds.has(matchId)),
    save: vi.fn(async (input: SaveMatchInput) => {
      importedIds.add(input.id);
      saved.push(input);
      return input as unknown as PersistedMatch;
    })
  };
}
