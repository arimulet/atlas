import { formatDateTime, formatTrainingPriority } from "@atlas/web/app/formatters";
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
        <SourcedItem
          label="Training priority"
          value={formatTrainingPriority(Number(dashboard.settings.effective.preferences["training.priority"]))}
          source={dashboard.settings.settings.preferences["training.priority"] ? "manual" : "effective"}
        />
        <SourcedItem
          label="Training GK"
          value={dashboard.club.training?.GK ? formatTrainingPriority(dashboard.club.training.GK) : "Not set"}
          source="observed"
        />
        <SourcedItem
          label="Training DEF"
          value={dashboard.club.training?.DEF ? formatTrainingPriority(dashboard.club.training.DEF) : "Not set"}
          source="observed"
        />
        <SourcedItem
          label="Training MID"
          value={dashboard.club.training?.MID ? formatTrainingPriority(dashboard.club.training.MID) : "Not set"}
          source="observed"
        />
        <SourcedItem
          label="Training ATT"
          value={dashboard.club.training?.ATT ? formatTrainingPriority(dashboard.club.training.ATT) : "Not set"}
          source="observed"
        />
      </dl>
    </Section>
  );
}