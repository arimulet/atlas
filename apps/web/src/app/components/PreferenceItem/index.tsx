import { formatLabel } from "@atlas/web/app/formatters";
import { PreferenceItemProps } from "./types";
import { TraceKind } from "../TraceKind";

export const PreferenceItem = ({ label, manual, effective }: PreferenceItemProps) => {
  return (
    <div className="preference-item">
      <div>
        <span>{label}</span>
        <strong>{formatLabel(effective)}</strong>
      </div>
      <TraceKind type={manual ? "manual" : "effective"} label={manual ? "manual" : "effective"} />      
    </div>
  );
};
