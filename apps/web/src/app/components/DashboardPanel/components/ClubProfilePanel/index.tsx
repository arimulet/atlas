import { formatDateTime } from "@atlas/web/app/formatters";
import { SourcedItem } from "@atlas/web/app/components/SourcedItem";
import { ClubProfilePanelProps } from "./types";
import { Section } from "../../../Section";

export const ClubProfilePanel = ({ dashboard }: ClubProfilePanelProps) => {
  return (
    <Section className="club-profile-panel" title="Club Profile" subtitle={dashboard.club.name}>
      <dl className="source-list">
        <SourcedItem label="Name" value={dashboard.club.name} source="effective" />
        <SourcedItem
          label="External id"
          value={dashboard.club.externalId}
          source="observed"
        />
        <SourcedItem
          label="Last observed"
          value={formatDateTime(dashboard.club.observedAt)}
          source="observed"
        />
      </dl>
    </Section>
  );
}