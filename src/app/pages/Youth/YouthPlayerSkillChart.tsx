import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { skillLevelLabel } from "../../view-models/skill-level-label";
import type { YouthSkillHistoryEntry } from "@atlas/web/app/types";

interface YouthPlayerSkillChartProps {
  history: YouthSkillHistoryEntry[];
}

export function YouthPlayerSkillChart({ history }: YouthPlayerSkillChartProps) {
  if (!history || history.length === 0) {
    return <p className="atlas-youth-chart-message">No history available for this player.</p>;
  }

  // Create chart data
  const data = history.map((entry) => ({
    name: `s${entry.season}w${entry.seasonWeek}`,
    skill: entry.skill,
    gameWeek: entry.gameWeek
  }));



  const ticks = Array.from({ length: 19 }, (_, i) => i);

  return (
    <div style={{ width: "100%", height: "450px", marginTop: "1rem", marginBottom: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="name" 
            stroke="#aaa"
            tick={{ fill: "#aaa", fontSize: 12 }} 
            tickMargin={10} 
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 18]}
            ticks={ticks}
            interval={0}
            stroke="#aaa"
            tick={{ fill: "#aaa", fontSize: 12 }}
            tickFormatter={(value) => `${value} - ${skillLevelLabel(value)}`}
            width={140}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", color: "#fff" }}
            labelStyle={{ color: "#aaa", marginBottom: "4px" }}
            formatter={(value: unknown) => [`${value} - ${skillLevelLabel(Number(value))}`, "Skill"]}
            labelFormatter={(label) => `Week: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="skill"
            stroke="#ff3b30"
            strokeWidth={2}
            dot={{ r: 4, fill: "#ff3b30" }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

