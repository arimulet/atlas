import { formatLabel } from "@atlas/web/app/formatters";
import { PreferenceItemProps } from "./types";

export const PreferenceItem = ({ label, manual, effective }: PreferenceItemProps) => {
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
