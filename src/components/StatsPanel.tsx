import React, { useMemo, useState } from "react";
import { BattleStats } from "../types/stats";
import { RACE_CONFIG } from "../data/races";

interface Props {
  stats: BattleStats[];
}

const TABS = [
  {
    key: "dmg",
    label: "⚔输出",
    color: "#f44336",
    field: "totalDamageDealt" as const,
  },
  {
    key: "taken",
    label: "🛡承伤",
    color: "#ff9800",
    field: "totalDamageReceived" as const,
  },
  {
    key: "heal",
    label: "💚治疗",
    color: "#4caf50",
    field: "totalHealingDone" as const,
  },
  {
    key: "phys",
    label: "🔨物理",
    color: "#ff5722",
    field: "physicalDamage" as const,
  },
  {
    key: "mag",
    label: "🔮魔法",
    color: "#7c4dff",
    field: "magicalDamage" as const,
  },
  { key: "pure", label: "✨纯粹", color: "#fff", field: "pureDamage" as const },
  {
    key: "lifesteal",
    label: "🩸吸血",
    color: "#e91e63",
    field: "lifeStealHealing" as const,
  },
  {
    key: "skillheal",
    label: "💚技能治疗",
    color: "#4caf50",
    field: "skillHealing" as const,
  },
  {
    key: "physTaken",
    label: "承物",
    color: "#ff5722",
    field: "physicalDamageReceived" as const,
  },
  {
    key: "magTaken",
    label: "承魔",
    color: "#7c4dff",
    field: "magicalDamageReceived" as const,
  },
  {
    key: "pureTaken",
    label: "承纯",
    color: "#fff",
    field: "pureDamageReceived" as const,
  },
];
const MAX_RANK = 5;

function UnitLine({
  s,
  i,
  val,
  maxVal,
  color,
}: {
  s: BattleStats;
  i: number;
  val: number;
  maxVal: number;
  color: string;
}) {
  const cfg = RACE_CONFIG[s.race] || { color: "#888", short: "?" };
  const pct = maxVal > 0 ? ((val / maxVal) * 100).toFixed(1) : "0";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 0",
        fontSize: 11,
      }}
    >
      <span
        style={{ color: "#555", width: 14, textAlign: "right", fontSize: 10 }}
      >
        {i + 1}
      </span>
      <span
        style={{ color: cfg.color, fontSize: 10, fontWeight: 700, width: 14 }}
      >
        {cfg.short}
      </span>
      <span
        style={{
          color: "#ccc",
          width: 56,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 500,
        }}
      >
        {s.name}
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: "#1a1a1a",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(val / maxVal) * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ color: "#fff", width: 40, textAlign: "right" }}>
        {val.toLocaleString()}
      </span>
      <span
        style={{ color: "#666", width: 32, textAlign: "right", fontSize: 10 }}
      >
        {pct}%
      </span>
    </div>
  );
}

/** Pure function: compute rankings from raw stats — no rendering */
function buildRankings(
  stats: BattleStats[],
  team: "ally" | "enemy",
  field: keyof BattleStats
) {
  const us = stats.filter((s) => s.team === team && (s[field] as number) > 0);
  const total = us.reduce((a, s) => a + (s[field] as number), 0);
  const sorted = [...us].sort(
    (a, b) => (b[field] as number) - (a[field] as number)
  );
  const max = sorted.length > 0 ? (sorted[0][field] as number) : 1;
  return { lines: sorted.slice(0, MAX_RANK), total, max };
}

function TeamStats({
  stats,
  team,
  label,
  color,
}: {
  stats: BattleStats[];
  team: "ally" | "enemy";
  label: string;
  color: string;
}) {
  const [tab, setTab] = useState("dmg");
  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  const { lines, total, max } = useMemo(
    () => buildRankings(stats, team, activeTab.field),
    [stats, team, activeTab.field]
  );

  if (stats.filter((s) => s.team === team).length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              border: "none",
              borderRadius: 4,
              background: tab === t.key ? t.color : "#222",
              color: tab === t.key ? "#000" : "#888",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {lines.map((s, i) => (
        <UnitLine
          key={s.unitId}
          s={s}
          i={i}
          val={s[activeTab.field] as number}
          maxVal={max}
          color={activeTab.color}
        />
      ))}
      {lines.length === 0 && (
        <div style={{ fontSize: 11, color: "#555" }}>暂无数据</div>
      )}
      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
        总计 {total.toLocaleString()}
      </div>
    </div>
  );
}

const StatsPanel: React.FC<Props> = ({ stats }) => (
  <div
    style={{
      background: "#111",
      border: "1px solid #333",
      borderRadius: 8,
      padding: 10,
    }}
  >
    <TeamStats stats={stats} team="ally" label="我方" color="#4fc3f7" />
    <TeamStats stats={stats} team="enemy" label="敌方" color="#ef5350" />
  </div>
);

export default StatsPanel;
