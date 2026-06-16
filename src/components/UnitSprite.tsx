import React, { useState, useEffect } from "react";
import { ArenaUnit, DamageType, RACE_NAMES } from "../types";
import { ALL_LINES } from "../data/lines";

const SC: Record<string, string> = {
  stun: "#f44",
  sleep: "#9c27b0",
  petrify: "#607d8b",
  freeze: "#03a9f4",
  bind: "#ff9800",
  burn: "#ff5722",
  curse: "#e91e63",
  silence: "#795548",
  inspire: "#4caf50",
  poison: "#7c4dff",
  antiHeal: "#000",
};
const SE: Record<string, string> = {
  stun: "💫",
  sleep: "💤",
  petrify: "🗿",
  freeze: "❄️",
  bind: "🔗",
  burn: "🔥",
  curse: "☠️",
  silence: "🔇",
  inspire: "✨",
  poison: "☣️",
  antiHeal: "🚫",
};
const RC: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
};
const BG: Record<string, string> = {
  beast: "linear-gradient(135deg,#4e342e,#3e2723)",
  hunter: "linear-gradient(135deg,#1b5e20,#2e7d32)",
  warrior: "linear-gradient(135deg,#b71c1c,#c62828)",
  mage: "linear-gradient(135deg,#0d47a1,#1565c0)",
  undead: "linear-gradient(135deg,#4a148c,#6a1b9a)",
  dragon: "linear-gradient(135deg,#e65100,#ef6c00)",
};

const UnitSprite: React.FC<{
  unit: ArenaUnit;
  onClick?: () => void;
  focused?: boolean;
}> = ({ unit, onClick, focused }) => {
  const rc = RC[unit.def.race] || "#999";
  const [dmgFlash, setDmgFlash] = useState(false);
  const [healFlash, setHealFlash] = useState(false);
  const [floatText, setFloatText] = useState<string | null>(null);
  const [floatColor, setFloatColor] = useState("#f44336");
  const [skLabel, setSkLabel] = useState<string | null>(null);
  const [skBubble, setSkBubble] = useState<string | null>(null);
  const [animCls, setAnimCls] = useState("");

  const dKey = unit.lastDamage
    ? `${unit.lastDamage.value}_${unit.lastDamage.time}`
    : "";
  const hKey = unit.lastHeal
    ? `${unit.lastHeal.value}_${unit.lastHeal.time}`
    : "";
  const skKey = unit.lastSkillCast?.time ?? 0;
  const actKey = unit.lastAction?.time ?? 0;

  // Damage/heal flash with type color
  useEffect(() => {
    if (!dKey) return;
    setDmgFlash(true);
    const dmg = unit.lastDamage!;
    const color =
      dmg.type === "magical"
        ? "#7c4dff"
        : dmg.type === "pure"
          ? "#fff"
          : "#f44336";
    setFloatColor(color);
    setFloatText(`-${dmg.value}`);
    // Slash for physical, burst for magical
    if (dmg.type === "physical" || !dmg.type) setAnimCls("slash");
    else setAnimCls("shake");
    const t1 = setTimeout(() => {
      setDmgFlash(false);
      setAnimCls("");
    }, 500);
    const t2 = setTimeout(() => setFloatText(null), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [dKey]);

  useEffect(() => {
    if (!hKey) return;
    setHealFlash(true);
    setFloatColor("#4caf50");
    setFloatText(`+${unit.lastHeal!.value}`);
    setAnimCls("");
    const t1 = setTimeout(() => {
      setHealFlash(false);
    }, 500);
    const t2 = setTimeout(() => setFloatText(null), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hKey]);

  // Skill speech bubble
  useEffect(() => {
    if (!skKey) return;
    const sk = unit.lastSkillCast!;
    setSkLabel(sk.name);
    // Show speech bubble with target info if available
    const target = unit.lastAction?.targetName;
    setSkBubble(target ? `${sk.name}→${target}` : sk.name);
    const t = setTimeout(() => {
      setSkLabel(null);
      setSkBubble(null);
    }, 1200);
    return () => clearTimeout(t);
  }, [skKey]);

  const hp = unit.currentHp / unit.maxHp;

  return (
    <div
      onClick={() => onClick?.()}
      className={animCls}
      style={{
        height: 74,
        borderRadius: 6,
        background: BG[unit.def.race] || "#222",
        border: `2px solid ${unit.isDead ? "#555" : focused ? "#ffeb3b" : rc}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: unit.isDead ? 0.3 : 1,
        position: "relative",
        overflow: "hidden",
        padding: "2px 4px",
        boxShadow: focused
          ? "0 0 12px rgba(255,235,59,0.5)"
          : dmgFlash
            ? "inset 0 0 20px rgba(244,67,54,0.8)"
            : healFlash
              ? "inset 0 0 20px rgba(76,175,80,0.8)"
              : "none",
      }}
    >
      {/* HP bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "#1a1a1a",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, hp * 100)}%`,
            height: "100%",
            background:
              hp > 0.5 ? "#4caf50" : hp > 0.25 ? "#ff9800" : "#f44336",
            transition: "width 0.12s",
          }}
        />
      </div>

      {/* Race badge */}
      <div
        style={{
          position: "absolute",
          top: 5,
          right: 4,
          fontSize: 8,
          padding: "1px 4px",
          borderRadius: 2,
          background: rc,
          color: "#000",
          fontWeight: 700,
        }}
      >
        {RACE_NAMES[unit.def.race]}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          lineHeight: 1.2,
          marginTop: 2,
        }}
      >
        {unit.def.name}
      </div>
      <div style={{ fontSize: 10, color: "#ddd" }}>
        {Math.max(0, Math.floor(unit.currentHp))}/{unit.maxHp}
      </div>

      {/* Cooldown indicator */}
      {unit.cooldownRemaining > 0 && !unit.isDead && (
        <div
          style={{
            fontSize: 8,
            color: "#ffeb3b",
            fontWeight: 700,
            marginTop: 1,
          }}
        >
          ⏳{unit.cooldownRemaining.toFixed(1)}s
        </div>
      )}

      {/* Speech bubble for skill */}
      {skBubble && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            fontWeight: 700,
            color: "#fff",
            background: "rgba(33,150,243,0.9)",
            padding: "2px 8px",
            borderRadius: "4px 4px 4px 0",
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            animation: "floatUpBubble 1.2s ease-out forwards",
          }}
        >
          💬 {skBubble}
        </div>
      )}

      {/* Dialogue line */}
      {unit.lastLine && (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 8,
            fontWeight: 600,
            color: "#ffeb3b",
            background: "rgba(0,0,0,0.8)",
            padding: "1px 6px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            zIndex: 10,
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            animation: "floatUp 0.8s ease-out forwards",
          }}
        >
          💭 {unit.lastLine}
        </div>
      )}

      {/* Floating damage/heal */}
      {floatText && (
        <div
          style={{
            position: "absolute",
            top: "28%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: floatText[0] == "+" ? 13 : 16,
            fontWeight: 900,
            pointerEvents: "none",
            color: floatColor,
            textShadow: "0 0 6px rgba(0,0,0,0.9)",
            zIndex: 5,
            animation: "floatUp 0.5s ease-out forwards",
          }}
        >
          {floatText}
        </div>
      )}

      {/* Casting */}
      {unit.isCasting && !unit.isDead && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 3,
            fontSize: 8,
            color: "#ffeb3b",
            fontWeight: 700,
            animation: "pulse 0.5s infinite",
          }}
        >
          ✦
        </div>
      )}

      {/* Status effects with emojis */}
      {unit.statuses.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 1,
            left: 1,
            right: 1,
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {unit.statuses.map((s, i) => (
            <span
              key={i}
              style={{
                fontSize: 8,
                padding: "0 3px",
                borderRadius: 2,
                background: SC[s.type] || "#666",
                color: "#fff",
                fontWeight: 600,
                lineHeight: "14px",
              }}
            >
              {SE[s.type] || s.type.slice(0, 2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
export default UnitSprite;
