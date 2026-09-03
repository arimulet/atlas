import { useState } from "react";
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
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
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
                isDetailsOpen={expandedProfile === profile.profile}
                key={profile.profile}
                onSelectPlayer={onSelectPlayer}
                onToggleDetails={() =>
                  setExpandedProfile((current) =>
                    current === profile.profile ? null : profile.profile
                  )
                }
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
  isDetailsOpen: boolean;
  profile: SquadProfileViewModel;
  onSelectPlayer: (playerId: string) => void;
  onToggleDetails: () => void;
}

function ProfileDepthRow({
  isDetailsOpen,
  onSelectPlayer,
  onToggleDetails,
  profile
}: ProfileDepthRowProps) {
  const detailsId = `squad-profile-${profile.profile}-details`;

  return (
    <>
      <tr>
        <th scope="row">
          <button
            aria-controls={detailsId}
            aria-expanded={isDetailsOpen}
            aria-label={`${isDetailsOpen ? "Hide" : "View"} details for ${profile.profileLabel}`}
            className="atlas-squad-profile-detail__toggle"
            onClick={onToggleDetails}
            type="button"
          >
            {isDetailsOpen ? "−" : "+"}
          </button>
          {profile.profileLabel}
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
      {isDetailsOpen ? (
        <tr className="atlas-squad-profile-detail-row">
          <td colSpan={6}>
            <div id={detailsId}>
              <SquadProfileDetail onSelectPlayer={onSelectPlayer} profile={profile} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
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
      <div className="atlas-squad-profile-detail__roles">
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
      </div>
      <div className="atlas-squad-profile-detail__insights">
        <SquadProfileRecommendations profile={profile} />
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
    </div>
  );
}
function SquadProfileRecommendations({ profile }: { profile: SquadProfileViewModel }) {
  const recommendations = profile.recommendations.filter(
    (recommendation) => recommendation.type !== "maintain"
  );

  if (recommendations.length === 0) return null;

  return (
    <div className="atlas-squad-profile-detail__recommendations">
      <h4>Recommended action</h4>
      {recommendations.map((recommendation) => {
        const financialImpact = financialImpactLabel(recommendation.type);

        return (
          <article
            className={"atlas-squad-profile-action is-" + recommendation.priority}
            key={recommendation.id}
          >
            <span className="atlas-squad-profile-action__meta">
              {recommendation.priority} · {recommendation.horizonLabel}
            </span>
            <strong>{recommendation.title}</strong>
            <p>{recommendation.description}</p>
            {financialImpact ? (
              <span className="atlas-squad-profile-action__financial-impact">
                {financialImpact}
              </span>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function financialImpactLabel(type: SquadProfileViewModel["recommendations"][number]["type"]) {
  if (type === "find_external") return "Requires funding · Review in Finances";
  if (type === "accelerate_development")
    return "Development support · No transfer budget estimated";
  if (type === "prepare_successor") return "Succession planning · Review in Finances";

  return null;
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

