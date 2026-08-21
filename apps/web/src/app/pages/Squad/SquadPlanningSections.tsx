import type { SquadRole } from "@atlas/domain";
import { PlayerLink } from "../../components/PlayerLink";
import {
  roleLabel,
  type SquadPlanningViewModel,
  type SquadProfilePlayerGroup,
  type SquadProfileViewModel
} from "./squad-planning-view-model";

interface SquadPlanningSectionsProps {
  viewModel: SquadPlanningViewModel;
  onSelectPlayer: (playerId: string) => void;
}

export function SquadPlanningSections({ onSelectPlayer, viewModel }: SquadPlanningSectionsProps) {
  return (
    <>
      <SquadPlanningSummary viewModel={viewModel} />
      <SquadProfileDepthTable profiles={viewModel.profiles} onSelectPlayer={onSelectPlayer} />
    </>
  );
}

interface SquadPlanningSummaryProps {
  viewModel: SquadPlanningViewModel;
}

function SquadPlanningSummary({ viewModel }: SquadPlanningSummaryProps) {
  const { profileCounts, roleCounts } = viewModel.summary;

  return (
    <section
      className="atlas-squad-planning-summary"
      aria-labelledby="squad-planning-summary-title"
    >
      <div>
        <span className="atlas-squad-planning-summary__eyebrow">Squad Planning</span>
        <h2 id="squad-planning-summary-title">{viewModel.summary.playerCount} Players</h2>
      </div>
      <div className="atlas-squad-planning-summary__roles" aria-label="Squad roles">
        {(["core", "developing", "prospect", "rotation", "depth", "transition"] as const).map(
          (role) => (
            <div className="atlas-squad-planning-summary__metric" key={role}>
              <span>{roleLabel(role)}</span>
              <strong>{roleCounts[role]}</strong>
            </div>
          )
        )}
      </div>
      <div className="atlas-squad-planning-summary__structure" aria-label="Profile status summary">
        <span>Profiles</span>
        <strong className="is-critical">{profileCounts.critical} Critical</strong>
        <strong className="is-thin">{profileCounts.thin} Thin</strong>
        <strong className="is-balanced">{profileCounts.balanced} Balanced</strong>
        <strong className="is-overstocked">{profileCounts.overstocked} Overstocked</strong>
        <span>{viewModel.summary.successionRisks} Succession risks</span>
        <span>{viewModel.summary.externalNeeds} External needs</span>
      </div>
    </section>
  );
}

interface SquadProfileDepthTableProps {
  profiles: readonly SquadProfileViewModel[];
  onSelectPlayer: (playerId: string) => void;
}

function SquadProfileDepthTable({ profiles, onSelectPlayer }: SquadProfileDepthTableProps) {
  return (
    <section
      className="atlas-squad-panel atlas-squad-panel--profiles"
      aria-labelledby="squad-profile-depth-title"
    >
      <div className="atlas-squad-panel__heading">
        <h2 id="squad-profile-depth-title" className="atlas-squad-panel__title">
          Profile Depth &amp; Succession
        </h2>
        <span className="atlas-squad-planning-legend">Current · Next season · Medium term</span>
      </div>
      <div className="atlas-squad-profile-table-wrap">
        <table className="atlas-squad-profile-table">
          <thead>
            <tr>
              <th scope="col">Profile</th>
              <th scope="col">Current</th>
              <th scope="col">Next season</th>
              <th scope="col">Medium term</th>
              <th scope="col">Succession</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <ProfileDepthRow
                key={profile.profile}
                onSelectPlayer={onSelectPlayer}
                profile={profile}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ProfileDepthRowProps {
  profile: SquadProfileViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function ProfileDepthRow({ onSelectPlayer, profile }: ProfileDepthRowProps) {
  return (
    <tr>
      <th scope="row">
        <details>
          <summary>{profile.profileLabel}</summary>
          <SquadProfileDetail onSelectPlayer={onSelectPlayer} profile={profile} />
        </details>
      </th>
      <td>
        <DepthCell snapshot={profile.current} />
      </td>
      <td>
        <DepthCell snapshot={profile.nextSeason} />
      </td>
      <td>
        <DepthCell snapshot={profile.mediumTerm} />
      </td>
      <td>
        <span className={`atlas-squad-planning-badge is-${profile.successionStatus}`}>
          {profile.successionLabel}
        </span>
      </td>
      <td>
        <span className={`atlas-squad-planning-badge is-${profile.status}`}>
          {profile.statusLabel}
        </span>
      </td>
    </tr>
  );
}

interface DepthCellProps {
  snapshot: {
    availablePlayers: number;
    strongOptions: number;
    developingOptions: number;
    prospects: number;
  };
}

function DepthCell({ snapshot }: DepthCellProps) {
  return (
    <span className="atlas-squad-depth-cell">
      <strong>{snapshot.availablePlayers}</strong>
      <small>
        {snapshot.strongOptions} strong · {snapshot.developingOptions} developing ·{" "}
        {snapshot.prospects} prospects
      </small>
    </span>
  );
}

interface SquadProfileDetailProps {
  profile: SquadProfileViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function SquadProfileDetail({ onSelectPlayer, profile }: SquadProfileDetailProps) {
  const groups: Array<{ key: SquadProfilePlayerGroup; label: string }> = [
    { key: "current", label: "Current options" },
    { key: "developing", label: "Developing" },
    { key: "prospect", label: "Prospects" },
    { key: "transition", label: "Transition" }
  ];

  return (
    <div className="atlas-squad-profile-detail">
      {groups.map((group) => {
        const players = profile.players.filter((player) => player.group === group.key);
        return players.length > 0 ? (
          <div key={group.key}>
            <h4>{group.label}</h4>
            <ul>
              {players.map((player) => (
                <li key={player.playerId}>
                  <PlayerLink playerId={player.playerId} onSelectPlayer={onSelectPlayer}>
                    {player.name}
                  </PlayerLink>
                  <span>
                    {player.age ?? "—"} · {player.roleLabel} · {player.lifecycleLabel}
                  </span>
                  <span>
                    Current {player.currentContribution} · Future {player.futureContribution}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })}
      <SquadSuccession profile={profile} onSelectPlayer={onSelectPlayer} />
      {profile.dependencyRisk ? (
        <p className="atlas-squad-profile-detail__notice">
          <strong>Dependency risk.</strong> {profile.dependencyRisk.playerName} provides
          significantly more current contribution than the next option (gap{" "}
          {profile.dependencyRisk.contributionGap}).
        </p>
      ) : null}
      {profile.congestionMessage ? (
        <p className="atlas-squad-profile-detail__notice">
          <strong>Development congestion.</strong> {profile.congestionMessage}
        </p>
      ) : null}
      {profile.missingPipeline ? (
        <p className="atlas-squad-profile-detail__notice">
          <strong>No future pipeline.</strong> No developing or prospect player is currently
          projected to cover this profile in the medium term.
        </p>
      ) : null}
      {profile.reasons.length > 0 ? (
        <ul className="atlas-squad-profile-detail__reasons">
          {profile.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface SquadSuccessionProps {
  profile: SquadProfileViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function SquadSuccession({ profile, onSelectPlayer }: SquadSuccessionProps) {
  return (
    <div className="atlas-squad-profile-detail__succession">
      <strong>Succession {profile.successionLabel}</strong>
      {profile.successorCandidates.length === 0 ? (
        <span>No internal successor identified.</span>
      ) : (
        profile.successorCandidates.map((candidate) => (
          <span key={candidate.playerId}>
            <PlayerLink playerId={candidate.playerId} onSelectPlayer={onSelectPlayer}>
              {candidate.playerName}
            </PlayerLink>
            <span>
              {" "}
              · {candidate.readinessLabel} · {candidate.confidence} confidence
            </span>
          </span>
        ))
      )}
    </div>
  );
}

export function planningConfidenceWarning(viewModel: SquadPlanningViewModel): string | null {
  return viewModel.hasLowConfidenceProjection
    ? "Some future squad projections have low confidence because player development plans are incomplete."
    : null;
}

export function describeManualRoleConflict(
  automaticRole: SquadRole,
  manualRole: SquadRole | null
): string | null {
  return manualRole !== null && automaticRole !== manualRole
    ? `ATLAS suggests ${roleLabel(automaticRole)}`
    : null;
}

export function roleOptions(): readonly SquadRole[] {
  return ["core", "developing", "prospect", "rotation", "depth", "transition"];
}

export function roleOptionLabel(role: SquadRole): string {
  return roleLabel(role);
}
