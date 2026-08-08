import { formatDateTime } from "@atlas/web/app/formatters";
import { SourcedItem } from "@atlas/web/app/components/SourcedItem";
import { ClubProfilePanelProps } from "./types";
import { Section } from "../../../Section";

export const ClubProfilePanel = ({ dashboard }: ClubProfilePanelProps) => {
  return (
    <Section className="club-profile-panel" title="Club Profile" subtitle={dashboard.club.profile.name}>
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
    </Section>
  );
}