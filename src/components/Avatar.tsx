import React, { useMemo } from "react";
import { Race } from "../types";

const RACE_COLORS: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
  holy: "#ffd54f",
};

const RACE_DARK: Record<string, string> = {
  beast: "#3e2723",
  hunter: "#1b5e20",
  warrior: "#b71c1c",
  mage: "#0d47a1",
  undead: "#4a148c",
  dragon: "#e65100",
};

const RACE_DARK2: Record<string, string> = {
  beast: "#4e342e",
  hunter: "#2e7d32",
  warrior: "#c62828",
  mage: "#1565c0",
  undead: "#6a1b9a",
  dragon: "#ef6c00",
};

const RACE_BG: Record<string, [string, string, string]> = {
  beast: ["#4e342e", "#3e2723", "#2a1c18"],
  hunter: ["#2e7d32", "#1b5e20", "#0d330d"],
  warrior: ["#c62828", "#b71c1c", "#7a1212"],
  mage: ["#1565c0", "#0d47a1", "#063a7a"],
  undead: ["#6a1b9a", "#4a148c", "#2e0e56"],
  dragon: ["#ef6c00", "#e65100", "#ab3d00"],
};

const ROLE_ICON: Record<string, string> = {
  tank: "🛡",
  dps: "⚔",
  support: "✦",
  ranged: "🏹",
};

function inferRole(stats: { hp: number; attack: number; physicalDef: number; attackInterval: number }): "tank" | "dps" | "support" | "ranged" {
  const { hp, attack, physicalDef, attackInterval } = stats;
  if (hp > 9000 && physicalDef > 350) return "tank";
  if (attackInterval >= 3.5 && attack < 700) return "ranged";
  if (attack > 800) return "dps";
  if (hp < 6000 && attack < 700) return "support";
  return "dps";
}

interface AvatarProps {
  name: string;
  race: Race | string;
  stats?: { hp: number; attack: number; physicalDef: number; attackInterval: number };
  size?: number;
  dead?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ name, race, stats, size = 40, dead }) => {
  const initial = useMemo(() => name.charAt(0), [name]);
  const rc = RACE_COLORS[race as string] || "#666";
  const rcDark = RACE_DARK[race as string] || "#333";
  const rcDark2 = RACE_DARK2[race as string] || "#222";
  const [c1, c2, c3] = RACE_BG[race as string] || ["#333", "#222", "#111"];
  const role = stats ? inferRole(stats) : "dps";
  const roleIcon = ROLE_ICON[role];
  const gid = useMemo(() => `av-${race}-${name}-${Math.random().toString(36).slice(2, 6)}`, [race, name]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        flexShrink: 0,
        filter: dead ? "grayscale(1) brightness(0.4)" : undefined,
        transition: "filter 0.3s",
      }}
    >
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="55%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${gid})`} stroke={rc} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="43" fill="none" stroke={rcDark} strokeWidth="0.5" strokeOpacity="0.4" />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="42"
        fontWeight="700"
        fill="#fff"
        style={{
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          textShadow: "0 2px 4px rgba(0,0,0,0.6)",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
        }}
        opacity="0.95"
      >
        {initial}
      </text>
      <text
        x="78"
        y="80"
        textAnchor="middle"
        fontSize="16"
        opacity="0.85"
      >
        {roleIcon}
      </text>
      <path
        d="M 20 78 A 45 45 0 0 1 80 78"
        fill="none"
        stroke={rcDark2}
        strokeWidth="2"
        strokeOpacity="0.3"
      />
    </svg>
  );
};

export default Avatar;
export { RACE_COLORS, RACE_BG, inferRole, ROLE_ICON };