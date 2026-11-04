import React, { useState, useEffect } from "react";
import { ArenaUnit, DamageType, RACE_NAMES } from "../types";
import Avatar, { RACE_COLORS } from "./Avatar";

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
  holy: "#ffd54f",
};
const BG: Record<string, string> = {
  beast: "linear-gradient(135deg,#4e342e22,#3e272344)",
  hunter: "linear-gradient(135deg,#1b5e2022,#2e7d3244)",
  warrior: "linear-gradient(135deg,#b71c1c22,#c6282844)",
  mage: "linear-gradient(135deg,#0d47a122,#1565c044)",
  undead: "linear-gradient(135deg,#4a148c22,#6a1b9a44)",
  dragon: "linear-gradient(135deg,#e6510022,#ef6c0044)",
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
  const [floatSize, setFloatSize] = useState(16);
  const [floatPrefix, setFloatPrefix] = useState("");
  const [skLabel, setSkLabel] = useState<string | null>(null);
  const [skBubble, setSkBubble] = useState<string | null>(null);
  const [skColor, setSkColor] = useState("#2196f3");
  const [animCls, setAnimCls] = useState("");
  const [deadAnim, setDeadAnim] = useState(false);

  const dKey = unit.lastDamage
    ? `${unit.lastDamage.value}_${unit.lastDamage.time}`
    : "";
  const hKey = unit.lastHeal
    ? `${unit.lastHeal.value}_${unit.lastHeal.time}`
    : "";
  const skKey = unit.lastSkillCast?.time ?? 0;
  const actKey = unit.lastAction?.time ?? 0;

  // Death animation trigger
  useEffect(() => {
    if (unit.isDead && !deadAnim) {
      setDeadAnim(true);
      setAnimCls("deathAnim");
      const t = setTimeout(() => setAnimCls("deadState"), 600);
      return () => clearTimeout(t);
    }
  }, [unit.isDead]);

  // Damage/heal flash with type color
  useEffect(() => {
    if (!dKey) return;
    setDmgFlash(true);
    const dmg = unit.lastDamage!;
    const isCrit = dmg.value > unit.currentAttack * 1.3;
    const color =
      dmg.type === "magical"
        ? "#b388ff"
        : dmg.type === "pure"
          ? "#fff"
          : "#ff5252";
    setFloatColor(isCrit ? "#ffd54f" : color); // v3: 暴击金色
    setFloatSize(isCrit ? 26 : 18);
    setFloatPrefix(isCrit ? "💥 " : "");
    setFloatText(`-${dmg.value}`);
    if (dmg.type === "physical" || !dmg.type) setAnimCls("slash");
    else if (dmg.type === "magical") setAnimCls("shake");
    else setAnimCls("pulse");
    const t1 = setTimeout(() => {
      setDmgFlash(false);
      if (!unit.isDead) setAnimCls("");
    }, 600);
    const t2 = setTimeout(() => setFloatText(null), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [dKey]);

  useEffect(() => {
    if (!hKey) return;
    setHealFlash(true);
    setFloatColor("#69f0ae");
    setFloatSize(16);
    setFloatPrefix("💚 ");
    setFloatText(`+${unit.lastHeal!.value}`);
    setAnimCls("");
    const t1 = setTimeout(() => {
      setHealFlash(false);
    }, 600);
    const t2 = setTimeout(() => setFloatText(null), 900);
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
    const target = unit.lastAction?.targetName;
    setSkBubble(target ? `${sk.name} → ${target}` : sk.name);
    // Color by damage type hint: physical skills orange, magical blue
    const skillDef = unit.def.skill;
    const isMagic = skillDef.damage?.some((d: any) => d.type === "magical");
    setSkColor(isMagic ? "#b388ff" : "#ffab40"); // v3
    const t = setTimeout(() => {
      setSkLabel(null);
      setSkBubble(null);
    }, 1500);
    return () => clearTimeout(t);
  }, [skKey]);

  const hp = unit.currentHp / unit.maxHp;

  return (
    <div
      onClick={() => onClick?.()}
      className={`unit-card ${animCls}`}
      style={{
        height: 80,
        borderRadius: 8,
        background: unit.isDead ? "var(--btn-bg)" : (BG[unit.def.race] || "transparent"),
        border: `2px solid ${unit.isDead ? "#444" : focused ? "#ffeb3b" : rc + "88"}`,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        opacity: unit.isDead ? 0.4 : 1,
        position: "relative",
        overflow: "visible",
        padding: "4px 6px",
        boxShadow: focused
          ? "0 0 0 3px rgba(255,215,64,0.9), 0 0 24px rgba(255,215,64,0.8), 0 0 48px rgba(255,215,64,0.4)"
          : dmgFlash
            ? "inset 0 0 20px rgba(244,67,54,0.8), 0 0 14px rgba(244,67,54,0.5), 0 0 0 2px rgba(255,80,80,0.4)"
            : healFlash
              ? "inset 0 0 20px rgba(76,175,80,0.7), 0 0 10px rgba(76,175,80,0.4)"
              : "none",
        transition: "box-shadow 0.15s, opacity 0.4s",
      }}
    >
      {/* Avatar */}
      <div className="unit-avatar" style={{ display: "flex" }}>
        <Avatar
          name={unit.def.name}
          race={unit.def.race}
          stats={unit.def.stats}
          size={42}
          dead={unit.isDead}
        />
      </div>

      {/* Right side: name + HP + status */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}>
        {/* Name + race badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, minHeight: 16 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: unit.isDead ? "var(--text-faint)" : "var(--text)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {unit.def.name}
          </span>
          <span
            className="unit-race-badge"
            style={{
              fontSize: 7,
              padding: "1px 4px",
              borderRadius: 2,
              background: rc,
              color: "#000",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {RACE_NAMES[unit.def.race]}
          </span>
        </div>

        {/* HP bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div
            style={{
              flex: 1,
              height: 8,
              background: "var(--slot-empty)",
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid var(--panel-border)",
              position: "relative",
              minWidth: 40,
            }}
          >
            <div
              style={{
                width: `${Math.max(0, hp * 100)}%`,
                height: "100%",
                background:
                  hp > 0.5 ? "#4caf50" : hp > 0.25 ? "#ff9800" : "#f44336",
                transition: "width 0.15s",
                borderRadius: 4,
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: unit.isDead ? "var(--text-faint)" : "var(--text)", fontFamily: "monospace", flexShrink: 0, fontWeight: 600 }}>
            {Math.max(0, Math.floor(unit.currentHp))}
            <span className="unit-hp-pct" style={{ fontSize: 7, color: "var(--text-faint)" }}>
              ({Math.round(hp * 100)}%)
            </span>
          </span>
        </div>

        {/* Bottom row: cooldown + casting + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 12, flexWrap: "wrap" }}>
          {/* Cooldown indicator */}
          {unit.cooldownRemaining > 0 && !unit.isDead && (
            <span style={{ fontSize: 8, color: "#ffeb3b", fontWeight: 700 }}>
              ⏳{unit.cooldownRemaining.toFixed(1)}
            </span>
          )}
          {/* Casting indicator */}
          {unit.isCasting && !unit.isDead && (
            <span style={{ fontSize: 8, color: "var(--accent)", fontWeight: 700 }} className="castPulse">
              ✦施法
            </span>
          )}
          {/* Status effects */}
          {unit.statuses.length > 0 && !unit.isDead && (
            <div style={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {unit.statuses.slice(0, 4).map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 9,
                    padding: "0 2px",
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
      </div>

      {/* Skill speech bubble */}
      {skBubble && !unit.isDead && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            fontWeight: 700,
            color: "#fff",
            background: `${skColor}ee`,
            padding: "3px 10px",
            borderRadius: "6px 6px 6px 0",
            whiteSpace: "nowrap",
            zIndex: 15,
            boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
            animation: "skillBubble 1.5s ease-out forwards",
          }}
        >
          ✦ {skBubble}
        </div>
      )}

      {/* Floating damage/heal */}
      {floatText && !unit.isDead && (
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: floatSize,
            fontWeight: 900,
            pointerEvents: "none",
            color: floatColor,
            textShadow: "0 0 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)",
            zIndex: 12,
            whiteSpace: "nowrap",
            animation: "floatUp2 0.9s ease-out forwards",
          }}
        >
          {floatPrefix}{floatText}
        </div>
      )}

      {/* Death overlay */}
      {unit.isDead && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 24,
            zIndex: 8,
            opacity: 0.8,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
          }}
        >
          💀
        </div>
      )}
    </div>
  );
};
export default UnitSprite;