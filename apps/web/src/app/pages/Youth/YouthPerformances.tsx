import { useEffect, useState } from "react";
import { fetchYouthPerformances, patchYouthObservations } from "../../api";
import { skillLevelLabel } from "../../view-models/skill-level-label";
import type { YouthMatchPerformancesDto, RealYouthAcademyPlanning } from "../../types";

interface YouthPerformancesProps {
  clubId: string | null;
  youthAcademy: RealYouthAcademyPlanning | null;
}

const EditableObservationCell = ({ 
  clubId, 
  playerId, 
  initialValue 
}: { 
  clubId: string; 
  playerId: number; 
  initialValue: string; 
}) => {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  const handleBlur = async () => {
    if (value === initialValue) return;
    setIsSaving(true);
    try {
      await patchYouthObservations(clubId, playerId, value);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <input
      type="text"
      className="atlas-youth-observations-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={isSaving}
      placeholder="Add note..."
    />
  );
};

export function YouthPerformances({ clubId, youthAcademy }: YouthPerformancesProps) {
  const [data, setData] = useState<YouthMatchPerformancesDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    fetchYouthPerformances(clubId).then(res => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId]);

  if (!youthAcademy || !data) {
    return loading ? <p className="atlas-youth-panel__message is-info">Loading performances...</p> : null;
  }

  // Separate GKs from field players using the formation field from Sokker XML (0 = GK, 1 = field)
  const gks = [];
  const fieldPlayers = [];

  for (const player of youthAcademy.derived.players) {
    if (player.status === "promoted") continue;

    const stats = data.players[String(player.playerId)];

    // formation === 0 means GK per Sokker XML. If formation is null (not yet synced), fall back to stats.
    const isGK = player.formation === 0 || (player.formation === null && stats?.calculatedPosition === "GK");

    if (isGK) {
      gks.push({ player, stats });
    } else {
      fieldPlayers.push({ player, stats });
    }
  }

  fieldPlayers.sort((a, b) => {
    const getSortWeight = (pos: string | null) => {
      if (pos === "RELEASE") return 3;
      if (!pos) return 2; // Sin pos.
      return 1; // DEF, MID, ATT
    };
    
    const posA = a.stats?.calculatedPosition ?? null;
    const posB = b.stats?.calculatedPosition ?? null;
    
    const weightA = getSortWeight(posA);
    const weightB = getSortWeight(posB);
    
    if (weightA !== weightB) return weightA - weightB;

    const posStrA = posA || "Z";
    const posStrB = posB || "Z";
    
    if (posStrA < posStrB) return -1;
    if (posStrA > posStrB) return 1;
    
    return a.player.name.localeCompare(b.player.name);
  });

  const gkCols = Array.from({ length: 32 }, (_, i) => i + 1);

  const formatPoints = (ratingObj: { rating: number, minutes: number } | null | undefined, isGk = false) => {
    if (!ratingObj || ratingObj.rating === 0) return { text: "", className: isGk ? "empty-slot" : "no-data" };
    const text = String(ratingObj.rating);
    const className = ratingObj.minutes < 60 ? "half-match" : "full-match";
    return { text, className };
  };

  const getSkillColorClass = (skill: number | null) => {
    if (skill === null) return "";
    if (skill <= 4) return "atlas-youth-skill-tragic-weak"; // 0-4 (tragico to debil)
    if (skill <= 9) return "atlas-youth-skill-regular-vgood"; // 5-9 (regular to muy bueno)
    if (skill <= 13) return "atlas-youth-skill-excellent-incredible"; // 10-13 (excelente to increible)
    return "atlas-youth-skill-brilliant-divine"; // 14+ (brillante to divino)
  };

  return (
    <div className="atlas-youth">
      <header className="atlas-youth__header">
        <h1>Academy Performances</h1>
      </header>

      <div className="atlas-youth-performances">
        <section className="atlas-youth-panel atlas-youth-panel--performances">
          <div className="atlas-youth-section-heading">
            <div>
              <p className="atlas-youth-panel__eyebrow">Chronological Performances</p>
              <h2 className="atlas-youth-panel__title atlas-section-title">Goalkeepers</h2>
            </div>
          </div>
            <div className="atlas-youth-table-wrap">
              <table className="atlas-youth-table atlas-youth-performances-table atlas-youth-gk-table">
                <colgroup>
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "auto" }} />
                  {gkCols.map(c => <col key={c} style={{ width: "2%" }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Level</th>
                    <th>Obs.</th>
                    {gkCols.map(c => <th key={c} className="atlas-youth-table__center" style={{ padding: "8px 2px", fontSize: "0.7rem" }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {gks.map(p => (
                    <tr key={p.player.id}>
                      <th scope="row" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.player.name} <span style={{ fontWeight: "normal", color: "var(--color-text-secondary, #888)", fontSize: "0.9em" }}>({p.player.age}yo, {p.player.weeksRemaining ?? "-"}w)</span>
                      </th>
                      <td className={getSkillColorClass(p.player.skill)}>
                        {p.player.skill !== null ? skillLevelLabel(p.player.skill) : "-"}
                      </td>
                      <td>
                        {clubId && p.player.playerId ? (
                          <EditableObservationCell clubId={clubId} playerId={p.player.playerId} initialValue={p.player.observations} />
                        ) : "-"}
                      </td>
                        {gkCols.map((_, i) => {
                          const match = p.stats?.gk?.[i];
                          const pts = formatPoints(match, true);
                          return (
                            <td key={i} className="performance-cell-wrapper" style={{ padding: "2px" }}>
                              <div className={"performance-cell " + pts.className} style={{ minWidth: 0, padding: "2px" }}>{pts.text}</div>
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </section>

        <section className="atlas-youth-panel atlas-youth-panel--performances" style={{ marginTop: "2rem" }}>
          <div className="atlas-youth-section-heading">
            <div>
              <p className="atlas-youth-panel__eyebrow">History by Position</p>
              <h2 className="atlas-youth-panel__title atlas-section-title">Field Players</h2>
            </div>
          </div>
          <div className="atlas-youth-table-wrap">
            <table className="atlas-youth-table atlas-youth-performances-table">
                <colgroup>
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "auto" }} />
                </colgroup>
                <thead>
                    <tr>
                      <th>Player</th>
                      <th className="atlas-youth-table__center">Position</th>
                      <th className="atlas-youth-table__center atlas-youth-header-def">DEF</th>
                      <th className="atlas-youth-table__center atlas-youth-header-mid">MID</th>
                      <th className="atlas-youth-table__center atlas-youth-header-att">ATT</th>
                      <th>Level</th>
                      <th>Obs.</th>
                    </tr>
                </thead>
              <tbody>
                {fieldPlayers.map(p => {
                  const def = formatPoints(p.stats?.def);
                  const mid = formatPoints(p.stats?.mid);
                  const att = formatPoints(p.stats?.att);
                  const pos = p.stats?.calculatedPosition || "UNKNOWN";
                  
                  return (
                    <tr key={p.player.id}>
                      <th scope="row">
                        {p.player.name} <span style={{ fontWeight: "normal", color: "var(--color-text-secondary, #888)", fontSize: "0.9em" }}>({p.player.age}yo, {p.player.weeksRemaining ?? "-"}w)</span>
                      </th>
                      <td className="atlas-youth-table__center">
                         <span className={"atlas-youth-decision-badge " + (pos === "UNKNOWN" ? "is-none" : "is-" + pos.toLowerCase())}>
                           {pos}
                         </span>
                      </td>
                      <td className="performance-cell-wrapper">
                        <div className={"performance-cell " + def.className}>{def.text}</div>
                      </td>
                      <td className="performance-cell-wrapper">
                        <div className={"performance-cell " + mid.className}>{mid.text}</div>
                      </td>
                      <td className="performance-cell-wrapper">
                        <div className={"performance-cell " + att.className}>{att.text}</div>
                      </td>
                      <td className={getSkillColorClass(p.player.skill)}>
                        {p.player.skill !== null ? skillLevelLabel(p.player.skill) : "-"}
                      </td>
                      <td>
                        {clubId && p.player.playerId ? (
                          <EditableObservationCell clubId={clubId} playerId={p.player.playerId} initialValue={p.player.observations} />
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
