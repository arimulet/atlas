import { OperatingPreferenceKey } from "@atlas/web/app/types";
import { PreferenceItem } from "@atlas/web/app/components/PreferenceItem";
import { SourcedItem } from "@atlas/web/app/components/SourcedItem";
import { OperatingSettingsPanelProps } from "./types";
import { Section } from "../../../Section";

const preferenceLabels: Record<OperatingPreferenceKey, string> = {
  "economy.riskTolerance": "Economy risk",
  "training.priority": "Training priority",
  "academy.investment": "Academy investment",
  "market.strategy": "Market strategy"
};

export const OperatingSettingsPanel = ({ dashboard }: OperatingSettingsPanelProps) => {
  return (
    <Section title="Operating Settings" subtitle="Effective reading">
      <div className="settings-columns">
        <dl className="source-list">
          <SourcedItem
            label="Currency"
            value={dashboard.settings.settings.currency}
            source="manual"
          />
          <SourcedItem
            label="Season"
            value={dashboard.settings.observed.season}
            source="observed"
          />
          <SourcedItem label="Week" value={dashboard.settings.observed.week} source="observed" />
        </dl>
        <dl className="source-list effective-list">
          <SourcedItem
            label="Currency"
            value={dashboard.settings.effective.currency}
            source="effective"
          />
          <SourcedItem
            label="Season"
            value={dashboard.settings.effective.season}
            source="effective"
          />
          <SourcedItem label="Week" value={dashboard.settings.effective.week} source="effective" />
        </dl>
      </div>
      <div className="preferences-grid">
        {(Object.keys(preferenceLabels) as OperatingPreferenceKey[]).map((key) => (
          <PreferenceItem
            key={key}
            label={preferenceLabels[key]}
            manual={dashboard.settings.settings.preferences[key]}
            effective={dashboard.settings.effective.preferences[key]}
          />
        ))}
      </div>
    </Section>
  );
};
