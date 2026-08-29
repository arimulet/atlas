import { useEffect, useState } from "react";
import { fetchYouthPerformances } from "../../api";
import { skillLevelLabel } from "../../view-models/skill-level-label";
import { useYouthDecisionEngine } from "./useYouthDecisionEngine";
import type { YouthMatchPerformancesDto, RealYouthAcademyPlanning } from "../../types";

interface YouthPerformancesProps {
  clubId: string | null;
  youthAcademy: RealYouthAcademyPlanning | null;
}

export function YouthPerformances({ clubId, youthAcademy }: YouthPerformancesProps) {
  const [data, setData] = useState<YouthMatchPerformancesDto | null>(null);
  const [loading, setLoading] = useState(false);

  // We need the decision engine to know the suggested profile (e.g., if they are a Goalkeeper but haven't played yet)
  const { decisionCandidates } = useYouthDecisionEngine({
    clubId,
    currency: null,
    youthAcademy
  });

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    fetchYouthPerformances(clubId).then(res => {
      setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clubId]);

  if (!youthAcademy || !data) {
    return loading ? <p className="atlas-youth-panel__message is-info">Cargando rendimientos...</p> : null;
  }

  // GKs vs Field Players
  const gks = [];
  const fieldPlayers = [];

  for (const player of youthAcademy.derived.players) {
    if (player.status === "promoted") continue;
    
    const realPlayerId = player.playerId;
    const stats = realPlayerId === undefined ? undefined : data.players[String(realPlayerId)];
    const decisionCandidate = decisionCandidates.find(
      (candidate) => candidate.playerId === String(realPlayerId)
    );
    
    const isGK = stats?.calculatedPosition === "GK" || decisionCandidate?.initialProfile === "goalkeeper";
    
    if (isGK) {
      gks.push({ player, stats });
    } else {
      fieldPlayers.push({ player, stats });
    }
  }

  fieldPlayers.sort((a, b) => {
    const posA = a.stats?.calculatedPosition || "Z";
    const posB = b.stats?.calculatedPosition || "Z";
    if (posA < posB) return -1;
    if (posA > posB) return 1;
    return 0;
  });

  const maxGkMatches = Math.max(...gks.map(g => g.stats?.gk?.length || 0), 10);
  const gkCols = Array.from({ length: maxGkMatches }, (_, i) => i + 1);

  const formatPoints = (ratingObj: { rating: number, minutes: number } | null | undefined) => {
    if (!ratingObj) return { text: "", className: "no-data" };
    const text = String(ratingObj.rating);
    const className = ratingObj.minutes < 60 ? "half-match" : "full-match";
    return { text, className };
  };

  return (
    <div className="atlas-youth">
      <header className="atlas-youth__header">
        <h1>Match Performances</h1>
      </header>

      <div className="atlas-youth-performances">
        <section className="atlas-youth-panel atlas-youth-panel--performances">
          <div className="atlas-youth-section-heading">
            <div>
              <p className="atlas-youth-panel__eyebrow">Rendimientos cronológicos</p>
              <h2 className="atlas-youth-panel__title atlas-section-title">Arqueros</h2>
            </div>
          </div>
          <div className="atlas-youth-table-wrap">
            <table className="atlas-youth-table atlas-youth-performances-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "150px" }}>Player</th>
                  <th style={{ minWidth: "100px" }}>Level</th>
                  {gkCols.map(c => <th key={c} className="atlas-youth-table__center">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {gks.map(p => (
                  <tr key={p.player.id}>
                    <th scope="row">{p.player.name}</th>
                    <td>{p.player.skill !== null ? skillLevelLabel(p.player.skill) : "-"}</td>
                    {gkCols.map((_, i) => {
                      const match = p.stats?.gk?.[i];
                      const pts = formatPoints(match);
                      return <td key={i} className={"performance-cell " + pts.className}>{pts.text}</td>;
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
              <p className="atlas-youth-panel__eyebrow">Historial por Posición</p>
              <h2 className="atlas-youth-panel__title atlas-section-title">Jugadores de Campo</h2>
            </div>
          </div>
          <div className="atlas-youth-table-wrap">
            <table className="atlas-youth-table atlas-youth-performances-table">
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Position</th>
                  <th className="atlas-youth-table__center">DEF</th>
                  <th className="atlas-youth-table__center">MID</th>
                  <th className="atlas-youth-table__center">ATT</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {fieldPlayers.map(p => {
                  const def = formatPoints(p.stats?.def);
                  const mid = formatPoints(p.stats?.mid);
                  const att = formatPoints(p.stats?.att);
                  const pos = p.stats?.calculatedPosition || "Release";
                  
                  return (
                    <tr key={p.player.id}>
                      <th scope="row">{p.player.name}</th>
                      <td>
                         <span className={"atlas-youth-decision-badge " + (pos === "Release" ? "is-release" : "is-retain")}>
                           {pos}
                         </span>
                      </td>
                      <td className={"performance-cell " + def.className}>{def.text}</td>
                      <td className={"performance-cell " + mid.className}>{mid.text}</td>
                      <td className={"performance-cell " + att.className}>{att.text}</td>
                      <td>{p.player.skill !== null ? skillLevelLabel(p.player.skill) : "-"}</td>
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
