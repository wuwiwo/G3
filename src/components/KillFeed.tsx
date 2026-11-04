import React, { useState, useEffect, useRef } from "react";
import { BattleLogEntry } from "../types";

interface KillEvent {
  id: string;
  time: number;
  killerName: string;
  killerRace: string;
  victimName: string;
  victimRace: string;
  killerTeam: "ally" | "enemy";
  skillName?: string;
}

const RC: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
  holy: "#ffd54f",
};

interface Props {
  log: BattleLogEntry[];
  units: { id: string; def: { name: string; race: string }; team: string }[];
  battleTime: number;
}

const KillFeed: React.FC<Props> = ({ log, units, battleTime }) => {
  const [events, setEvents] = useState<KillEvent[]>([]);
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find death events and match with the killer
    for (const entry of log) {
      if (entry.type !== "death") continue;
      if (processedRef.current.has(entry.id)) continue;
      processedRef.current.add(entry.id);

      // Parse victim from text or targetId
      const victim = entry.targetId
        ? units.find((u) => u.id === entry.targetId)
        : null;
      if (!victim) continue;

      // Find the most recent damage/skill entry before this death (within 1s)
      const deathTime = entry.time;
      let killer: any = null;
      let skillName: string | undefined;

      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (e.time < deathTime - 1.5) break;
        if (e.time > deathTime) continue;
        if (e.type === "damage" && e.sourceId) {
          const src = units.find((u) => u.id === e.sourceId);
          if (src && src.team !== victim.team) {
            killer = src;
            break;
          }
        }
        if (e.type === "skill" && e.sourceId) {
          const src = units.find((u) => u.id === e.sourceId);
          if (src && src.team !== victim.team) {
            killer = src;
            skillName = e.text.match(/【(.+?)】/)?.[1] || e.text;
            break;
          }
        }
      }

      const ke: KillEvent = {
        id: entry.id,
        time: deathTime,
        killerName: killer?.def?.name || "未知",
        killerRace: killer?.def?.race || "unknown",
        victimName: (victim as any).def.name,
        victimRace: (victim as any).def.race,
        killerTeam: killer?.team || "enemy",
        skillName,
      };
      setEvents((prev) => [...prev.slice(-4), ke]);
    }
  }, [log]);

  // Auto-expire events older than 5s
  useEffect(() => {
    if (events.length === 0) return;
    const t = setTimeout(() => {
      setEvents((prev) => prev.filter((e) => battleTime - e.time < 5));
    }, 1000);
    return () => clearTimeout(t);
  }, [battleTime, events.length]);

  if (events.length === 0) return null;

  return (
    <div style={{
      position: "absolute",
      top: 36,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 30,
      display: "flex",
      flexDirection: "column",
      gap: 3,
      alignItems: "center",
      pointerEvents: "none",
      maxWidth: 400,
      width: "90%",
    }}>
      {events.slice(-3).map((e) => {
        const killerColor = RC[e.killerRace] || "#888";
        const victimColor = RC[e.victimRace] || "#888";
        const isAllyKill = e.killerTeam === "ally";
        return (
          <div
            key={e.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 16,
              background: "rgba(13,13,26,0.85)",
              border: `1px solid ${isAllyKill ? "#4fc3f744" : "#ef535044"}`,
              fontSize: 11,
              fontWeight: 600,
              color: "#ddd",
              animation: "killFeedIn 0.3s ease-out",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{ color: killerColor, fontWeight: 700 }}>
              {e.killerName}
            </span>
            <span style={{ fontSize: 9, color: "#666" }}>
              {e.skillName ? `「${e.skillName}」` : ""}
            </span>
            <span style={{ color: isAllyKill ? "#4fc3f7" : "#ef5350", fontSize: 10 }}>
              ⚔
            </span>
            <span style={{ color: victimColor, fontWeight: 700, opacity: 0.7, textDecoration: "line-through" }}>
              {e.victimName}
            </span>
            <span style={{ fontSize: 14 }}>💀</span>
          </div>
        );
      })}
    </div>
  );
};

export default KillFeed;