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
      <dl className="source-list">
        <SourcedItem
          label="Currency"
          value={dashboard.club.settings.currency?.name}
          source="manual"
        />
      </dl>
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
