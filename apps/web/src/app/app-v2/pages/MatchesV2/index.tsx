import {
  createMatchesPageViewModel,
  matchTypeLabel,
  type MatchesPageViewModel,
  type WeeklyPlayerMinutesViewModel
} from "../../view-models/matches-view-model";
import type { MatchesPageMatchType, MatchesV2Props } from "./types";
import { V2PlayerLink } from "../../components/V2PlayerLink";
import { V2StatusBadge } from "../../components/V2StatusBadge";

export function MatchesV2({ data, onSelectPlayer, status }: MatchesV2Props) {
  const viewModel = data ? createMatchesPageViewModel(data) : null;

  return (
    <div className="v2-matches">
      <header className="v2-matches__header">
        <h1>Matches</h1>
      </header>

      <MatchAttention status={status} />
      <RecentMatches data={viewModel} status={status} />
      <WeeklyPlayerMinutes data={viewModel} onSelectPlayer={onSelectPlayer} status={status} />
    </div>
  );
}

function MatchAttention({ status }: Pick<MatchesV2Props, "status">) {
  return (
    <section
      className="v2-matches-panel v2-matches-panel--attention"
      aria-labelledby="match-attention-title"
    >
      <h2 id="match-attention-title" className="v2-section-title">
        Match Attention
      </h2>
      {status === "loading" ? (
        <p>Loading match-related diagnostics...</p>
      ) : status === "error" ? (
        <p className="is-error">Match data is unavailable.</p>
      ) : (
        <p className="is-clear">✓ No match-related issues requiring attention</p>
      )}
    </section>
  );
}

interface MatchesSectionProps {
  data: MatchesPageViewModel | null;
  status: MatchesV2Props["status"];
}

function RecentMatches({ data, status }: MatchesSectionProps) {
  return (
    <section className="v2-matches-section" aria-labelledby="recent-matches-title">
      <div className="v2-matches-section__heading">
        <h2 id="recent-matches-title" className="v2-section-title">
          Recent Matches
        </h2>
        <span>{data?.recentMatches.length ?? 0}</span>
      </div>
      {status === "loading" ? <MatchesMessage>Loading matches...</MatchesMessage> : null}
      {status === "error" ? <MatchesMessage>Unable to load matches.</MatchesMessage> : null}
      {status === "idle" ? (
        <MatchesMessage>Import a club snapshot to load matches.</MatchesMessage>
      ) : null}
      {status === "ready" && data?.recentMatches.length === 0 ? (
        <MatchesMessage>No matches available.</MatchesMessage>
      ) : null}
      {status === "ready" && data && data.recentMatches.length > 0 ? (
        <div className="v2-matches-table-wrap">
          <table className="v2-matches-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Opponent</th>
                <th scope="col">H/A</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.recentMatches.map((match) => (
                <tr key={match.id}>
                  <td>{match.dateLabel}</td>
                  <td>{match.matchTypeLabel}</td>
                  <td>{match.opponent.name}</td>
                  <td>{match.side === "HOME" ? "H" : "A"}</td>
                  <td>
                    {match.score.club}–{match.score.opponent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

interface WeeklyPlayerMinutesProps extends MatchesSectionProps {
  onSelectPlayer: (playerId: string) => void;
}

function WeeklyPlayerMinutes({ data, onSelectPlayer, status }: WeeklyPlayerMinutesProps) {
  return (
    <section
      className="v2-matches-section v2-matches-section--primary"
      aria-labelledby="weekly-player-minutes-title"
    >
      <div className="v2-matches-section__heading">
        <div>
          <h2 id="weekly-player-minutes-title" className="v2-section-title">
            Weekly Player Minutes
          </h2>
          {data?.currentPeriodLabel ? <p>{data.currentPeriodLabel}</p> : null}
        </div>
      </div>
      {status === "loading" ? <MatchesMessage>Loading player minutes...</MatchesMessage> : null}
      {status === "error" ? <MatchesMessage>Unable to load player minutes.</MatchesMessage> : null}
      {status === "idle" ? (
        <MatchesMessage>Import a club snapshot to load player minutes.</MatchesMessage>
      ) : null}
      {status === "ready" && data?.weeklyPlayerMinutes.length === 0 ? (
        <MatchesMessage>
          No player minutes available for the current training period.
        </MatchesMessage>
      ) : null}
      {status === "ready" && data && data.weeklyPlayerMinutes.length > 0 ? (
        <WeeklyPlayerMinutesTable data={data} onSelectPlayer={onSelectPlayer} />
      ) : null}
    </section>
  );
}

interface WeeklyPlayerMinutesTableProps {
  data: MatchesPageViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function WeeklyPlayerMinutesTable({ data, onSelectPlayer }: WeeklyPlayerMinutesTableProps) {
  return (
    <div className="v2-matches-table-wrap">
      <table className="v2-matches-table v2-matches-minutes-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            {data.matchTypes.map((matchType) => (
              <th scope="col" key={matchType}>
                <span>{matchTypeLabel(matchType)}</span>
                <small>min</small>
              </th>
            ))}
            <th scope="col">Total minutes</th>
            <th scope="col">Effective training</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.weeklyPlayerMinutes.map((player) => (
            <WeeklyPlayerMinutesRow
              key={player.playerId}
              matchTypes={data.matchTypes}
              onSelectPlayer={onSelectPlayer}
              player={player}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface WeeklyPlayerMinutesRowProps {
  matchTypes: MatchesPageMatchType[];
  onSelectPlayer: (playerId: string) => void;
  player: WeeklyPlayerMinutesViewModel;
}

function WeeklyPlayerMinutesRow({
  matchTypes,
  onSelectPlayer,
  player
}: WeeklyPlayerMinutesRowProps) {
  return (
    <tr>
      <th scope="row">
        <V2PlayerLink playerId={String(player.playerId)} onSelectPlayer={onSelectPlayer}>
          {player.playerName}
        </V2PlayerLink>
      </th>
      {matchTypes.map((matchType) => (
        <td className="v2-matches-table__numeric" key={matchType}>
          {player.minutesByMatchType[matchType] ?? "—"}
        </td>
      ))}
      <td className="v2-matches-table__numeric">{player.totalMinutes}</td>
      <td className="v2-matches-table__numeric">{player.effectiveTrainingLabel}</td>
      <td>
        <V2StatusBadge status={player.statusLabel === "—" ? null : player.statusLabel} />
      </td>
    </tr>
  );
}

interface MatchesMessageProps {
  children: string;
}

function MatchesMessage({ children }: MatchesMessageProps) {
  return <p className="v2-matches-message">{children}</p>;
}
