import { formatDateTime } from "@atlas/web/app/formatters";
import { SourcedItem } from "@atlas/web/app/components/SourcedItem";
import { ClubProfilePanelProps } from "./types";

export const ClubProfilePanel = ({ dashboard }: ClubProfilePanelProps) => {
  return (
    <section className="panel club-profile-panel">
      <div className="panel-heading">
        <p className="eyebrow">Club Profile</p>
        <h2>{dashboard.club.profile.name}</h2>
      </div>
      <dl className="source-list">
        <SourcedItem label="Observed name" value={dashboard.club.observed.name} source="observed" />
        <SourcedItem label="Manual name" value={dashboard.club.manual.name} source="manual" />
        <SourcedItem
          label="Effective name"
          value={dashboard.club.profile.name}
          source="effective"
        />
        <SourcedItem
          label="External id"
          value={dashboard.club.profile.externalId}
          source="observed"
        />
        <SourcedItem
          label="Last observed"
          value={formatDateTime(dashboard.club.observed.observedAt)}
          source="observed"
        />
      </dl>
    </section>
  );
}