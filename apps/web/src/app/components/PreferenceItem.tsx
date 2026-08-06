import { formatLabel } from "../formatters";

export interface PreferenceItemProps {
  label: string;
  manual: string | undefined;
  effective: string;
}

export function PreferenceItem({ label, manual, effective }: PreferenceItemProps) {
  return (
    <div className="preference-item">
      <div>
        <span>{label}</span>
        <strong>{formatLabel(effective)}</strong>
      </div>
      <span className={`trace-kind ${manual ? "manual" : "effective"}`}>
        {manual ? "manual" : "effective"}
      </span>
    </div>
  );
}
