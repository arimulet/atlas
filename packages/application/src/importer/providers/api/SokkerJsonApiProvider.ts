import type { SokkerCredentials } from "../../types.js";
import type {
  CurrentClubContextDto,
  JuniorDto,
  TrainerDto,
  TrainingDataDto,
  TrainingSummaryDto,
  JuniorMatchDto
} from "../../types.js";
import type { SokkerDataProvider } from "../SokkerDataProvider.js";
import type {
  SokkerCurrentApiDto,
  SokkerJuniorsApiDto,
  SokkerApiTrainingFormationsDto,
  SokkerTrainersApiDto,
  SokkerTrainingApiDto,
  SokkerTrainingSummaryApiDto
} from "./dtos.js";
import {
  mapCurrentApiToCurrentClubContext,
  mapJuniorsApiToJuniors,
  mapTrainingFormationsApiToTraining,
  mapTrainersApiToTrainers,
  mapTrainingApiToTrainingData,
  mapTrainingSummaryApiToTrainingSummary
} from "./mappers.js";

export class SokkerJsonApiProvider implements SokkerDataProvider {
  private sessionCookie: string | null = null;
  private loginPromise: Promise<void> | null = null;
  private xmlSessionCookie: string | null = null;
  private xmlLoginPromise: Promise<void> | null = null;

  constructor(private readonly credentials: SokkerCredentials) {}

  private async loginXml(): Promise<void> {
    if (this.xmlSessionCookie) return;
    if (!this.xmlLoginPromise) {
      this.xmlLoginPromise = this.authenticateXml().catch((err) => {
        this.xmlLoginPromise = null;
        throw err;
      });
    }
    return this.xmlLoginPromise;
  }

  private async authenticateXml(): Promise<void> {
    const params = new URLSearchParams();
    params.append("ilogin", this.credentials.login);
    params.append("ipassword", this.credentials.password);

    const response = await fetch("https://sokker.org/start.php?session=xml", {
      method: "POST",
      body: params
    });

    if (!response.ok) {
      throw new Error(`XML Auth failed with status ${response.status}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("No set-cookie header returned from XML auth");
    }

    const match = setCookie.match(/XMLSESSID=([^;]+)/);
    if (!match) {
      throw new Error("XMLSESSID not found in set-cookie header");
    }

    this.xmlSessionCookie = match[0];
  }

  async login(): Promise<void> {
    if (this.sessionCookie) {
      return;
    }

    this.loginPromise ??= this.authenticate();

    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  async getCurrent(): Promise<CurrentClubContextDto> {
    const response = await this.get<SokkerCurrentApiDto>("current");
    const formationsResponse = await this.get<SokkerApiTrainingFormationsDto>(
      "training/formations"
    );

    return mapResource("current", () => {
      const training = mapTrainingFormationsApiToTraining(formationsResponse);

      return mapCurrentApiToCurrentClubContext({
        ...response,
        team: { ...response.team, training }
      });
    });
  }

  async getTraining(): Promise<TrainingDataDto> {
    const response = await this.get<SokkerTrainingApiDto>("training");

    return mapResource("training", () => mapTrainingApiToTrainingData(response.players));
  }

  async getTrainers(): Promise<TrainerDto[]> {
    const response = await this.get<SokkerTrainersApiDto>("trainer");

    return mapResource("trainer", () => mapTrainersApiToTrainers(response.trainers));
  }

  async getJuniors(): Promise<JuniorDto[]> {
    const response = await this.get<SokkerJuniorsApiDto>("junior");

    return mapResource("junior", () => mapJuniorsApiToJuniors(response.juniors));
  }

  async getTrainingSummary(): Promise<TrainingSummaryDto> {
    const response = await this.get<SokkerTrainingSummaryApiDto>("training/summary");

    return mapResource("training summary", () => mapTrainingSummaryApiToTrainingSummary(response));
  }

  async getJuniorMatches(season: number): Promise<Omit<JuniorMatchDto, "playerStats">[]> {
    const current = await this.getCurrent();
    const teamId = current.team.id;
    
    // The API ignores leagueType filters, so we fetch by season directly.
    // We make 2 requests (previous and current season) and filter locally.
    const [prevSeason, currentSeason] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.get<{ matches: any[] }>(`team/${teamId}/match?filter[season]=${season - 1}&filter[limit]=100`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.get<{ matches: any[] }>(`team/${teamId}/match?filter[season]=${season}&filter[limit]=100`)
    ]);
    
    const allMatches = [...(prevSeason.matches || []), ...(currentSeason.matches || [])];
    
    const juniorMatches = allMatches
      .filter(m => m.league?.type?.name === "junior" || m.league?.type?.name === "junior_qualify" || m.league?.type === "junior")
      .map(m => ({
        matchId: m.id,
        clubId: teamId,
        season: m.time?.gameDay?.season ?? current.calendar.season,
        gameWeek: m.time?.gameDay?.week ?? current.calendar.gameWeek,
        seasonWeek: m.time?.gameDay?.seasonWeek ?? m.round ?? current.calendar.seasonWeek,
        dateExpected: m.time?.time?.dateTime ?? m.time?.gameDay?.date?.date ?? "",
        isFinished: m.time?.wasPlayed ?? false
      }));
      
    return juniorMatches;
  }

  async getJuniorsXml(): Promise<Array<{ id: number; formation: number | null }>> {
    await this.loginXml();
    const response = await fetch("https://sokker.org/xml/juniors.xml", {
      headers: { cookie: this.xmlSessionCookie! }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch juniors XML with status ${response.status}`);
    }

    const xmlText = await response.text();
    const { parseJuniorsXml } = await import("../../parsers/xml-juniors-parser.js");
    return parseJuniorsXml(xmlText);
  }

  async getMatchXml(matchId: number): Promise<string> {
    await this.loginXml();
    const response = await fetch(`https://sokker.org/xml/match-${matchId}.xml`, {
      headers: {
        cookie: this.xmlSessionCookie!
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch XML for match ${matchId} with status ${response.status}`);
    }

    return response.text();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getMatchLineup(matchId: number): Promise<{ homePlayers: any[], awayPlayers: any[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.get<any>(`match/${matchId}/lineup`);
    return {
      homePlayers: response.homePlayers || [],
      awayPlayers: response.awayPlayers || []
    };
  }

  private async get<T>(path: string): Promise<T> {
    await this.login();

    const url = new URL(path, ensureTrailingSlash("https://sokker.org/api"));
    const sessionCookie = this.sessionCookie;
    if (!sessionCookie) {
      throw new Error("Sokker JSON API provider is not authenticated.");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { Cookie: sessionCookie }
    });

    if (!response.ok) {
      throw new Error(
        `Sokker API request failed (${response.status}) for ${url.pathname}${url.search}: ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  }

  private async authenticate(): Promise<void> {
    const response = await fetch("https://sokker.org/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: this.credentials.login,
        password: this.credentials.password,
        remember: false
      })
    });
    await response.text();

    if (!response.ok) {
      throw new Error(`Sokker API authentication failed (${response.status}).`);
    }

    this.sessionCookie = readSessionCookie(response.headers.get("set-cookie"));
  }

  async getTransfers(limit: number, offset: number): Promise<import("../../types.js").ActiveTransferDto[]> {
    const response = await this.get<unknown>(`transfer?filter[offset]=${offset}&filter[limit]=${limit}&filter[sort][by]=deadline`);
    const { sokkerActiveTransfersResponseSchema } = await import("./transfer-dtos.js");
    const parsed = sokkerActiveTransfersResponseSchema.parse(response);
    
    return (parsed.transfers || []).map(t => {
      let deadlineStr = new Date().toISOString();
      if (typeof t.deadline === "string") deadlineStr = t.deadline;
      else if (t.deadline?.date?.date) deadlineStr = t.deadline.date.date;
      else if (t.deadline?.value) deadlineStr = t.deadline.value;

      // Sokker sends dates like "2026-09-01 11:09:10.000000" without timezone info.
      // We must append 'Z' to treat it as UTC, avoiding local timezone shifts.
      const match = deadlineStr.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
      if (match) {
        deadlineStr = `${match[1]}T${match[2]}Z`;
      }

      return {
        playerId: t.player.id,
        deadline: deadlineStr,
        player: {
          name: t.player.info?.name?.full ?? "Unknown",
          countryId: t.player.info?.country?.code ?? 0,
          age: t.player.info?.characteristics?.age ?? 0,
          skills: (t.player.info?.skills || {}) as Record<string, number>
        },
        status: "active" as const,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      };
    });
  }

  async getTransferHistory(limit: number, offset: number): Promise<import("../../types.js").FinalTransferDto[]> {
    const response = await this.get<unknown>(`transfer/history?filter[offset]=${offset}&filter[limit]=${limit}`);
    const { sokkerHistoryTransfersResponseSchema } = await import("./transfer-dtos.js");
    const parsed = sokkerHistoryTransfersResponseSchema.parse(response);
    
    return (parsed.transfers || []).map(t => {
      let dateStr = new Date().toISOString();
      if (typeof t.date === "string") dateStr = t.date;
      else if (t.date?.date?.date) dateStr = t.date.date.date;
      else if (t.date?.value) dateStr = t.date.value;
      else if (t.date?.date) dateStr = t.date.date;

      let salePrice = 0;
      let currency = "PLN";
      if (typeof t.price === "number") salePrice = t.price;
      else if (t.price?.bid?.value) salePrice = t.price.bid.value;
      else if (t.price?.value) salePrice = t.price.value;
      
      if (typeof t.price === "object" && t.price) {
         if (t.price.currency) currency = t.price.currency;
         else if (t.price.bid?.currency) currency = t.price.bid.currency;
      }
      
      return {
        transferKey: `transfer-${t.id || t.player?.id || Date.now()}`,
        playerId: t.player?.id ?? 0,
        name: t.player?.info?.name?.full ?? "Unknown",
        transferDate: new Date(dateStr).toISOString(),
        salePrice,
        currency,
        age: t.player?.info?.characteristics?.age ?? 0
      };
    }).filter(t => t.playerId !== 0);
  }

  async getPlayerTransferHistory(playerId: number): Promise<import("../../types.js").FinalTransferDto[]> {
    const response = await this.get<unknown>(`player/${playerId}/transfer`);
    const { sokkerPlayerTransferHistoryResponseSchema } = await import("./transfer-dtos.js");
    const parsed = sokkerPlayerTransferHistoryResponseSchema.parse(response);

    return (parsed.transfers || []).map(t => {
      let dateStr = new Date().toISOString();
      if (t.date?.timestamp) {
        dateStr = new Date(t.date.timestamp * 1000).toISOString();
      } else if (t.date?.value) {
        dateStr = t.date.value;
      }

      return {
        transferKey: `transfer-${t.playerId}-${t.date?.timestamp || Date.now()}`,
        playerId: t.playerId,
        name: t.playerName?.full ?? "Unknown",
        transferDate: dateStr,
        salePrice: t.price?.value ?? 0,
        currency: t.price?.currency ?? "PLN",
        age: t.age ?? 0
      };
    });
  }
}

function mapResource<T>(resource: string, mapper: () => T): T {
  try {
    return mapper();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);

    throw new Error(`Failed to map Sokker ${resource} response: ${detail}`, { cause });
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function readSessionCookie(setCookie: string | null): string {
  const match = setCookie?.match(/PHPSESSID=([^;]+)/);

  if (!match?.[1]) {
    throw new Error("No JSON API session cookie received from Sokker.");
  }

  return `PHPSESSID=${match[1]}`;
}
