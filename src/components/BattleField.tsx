import React, { useMemo, useRef, useState, useEffect } from "react";
import { BattleState, Row, ROW_NAMES, ArenaUnit } from "../types";
import UnitSprite from "./UnitSprite";

interface Props {
  battle: BattleState;
  side: "ally" | "enemy";
  onUnitClick?: (unit: ArenaUnit) => void;
  focusUnit?: ArenaUnit | null;
}

const bondRC: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
  holy: "#ffd54f",
};
const bondNM: Record<string, string> = {
  beast: "兽",
  hunter: "猎",
  warrior: "战",
  mage: "法",
  undead: "亡",
  dragon: "龙",
  holy: "圣",
};

// Damage type → arrow color
const DMG_ARROW_COLOR: Record<string, string> = {
  physical: "#ff5252",
  magical: "#b388ff",
  pure: "#ffffff",
};

function getTarget(battle: BattleState, u: ArenaUnit): ArenaUnit | null {
  if (!u.lastHitTarget) return null;
  const target = battle.units.find((x) => x.id === u.lastHitTarget);
  if (target && !target.isDead) return target;
  return null;
}

// Cell layout constants — must match the grid rendering below
const CELL_W = 86;  // approximate cell width
const CELL_H = 84;  // approximate cell height
const ROW_LABEL_W = 26;

const BattleField: React.FC<Props> = ({
  battle,
  side,
  onUnitClick,
  focusUnit,
}) => {
  const grid = useMemo(() => {
    const g: (ArenaUnit | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    for (const u of battle.units) {
      if (u.team === side && u.row >= 0 && u.row <= 2 && u.col >= 0 && u.col <= 2) {
        g[u.row][u.col] = u;
      }
    }
    return g;
  }, [battle.units, side]);

  const isFinished = battle.phase === "finished";
  const won = battle.winner === side;
  const bonds = battle.bonds?.[side] || [];
  const now = battle.time;
  // v3: 动态测量格子尺寸（修复箭头偏移——原 CELL_W=86 近似值）
  const panelRef = useRef<HTMLDivElement>(null);
  const [cellW, setCellW] = useState(CELL_W);
  const [cellH, setCellH] = useState(CELL_H);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      const gridEl = el.querySelector("[data-grid]");
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      setCellW(rect.width / 3);
      const rowEl = gridEl.firstElementChild as HTMLElement | null;
      if (rowEl) setCellH(rowEl.getBoundingClientRect().height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // v3: 全局格子坐标（跨面板箭头用）——每 tick 测量 DOM 实际位置
  const cellRectsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    const map = new Map<string, { x: number; y: number }>();
    document.querySelectorAll("[data-cell-id]").forEach((el) => {
      const id = el.getAttribute("data-cell-id");
      if (!id) return;
      const r = el.getBoundingClientRect();
      map.set(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    cellRectsRef.current = map;
  }, [now, battle.units]);

  // Attack arrows — colored by damage type, longer duration
  const arrowLines = useMemo(() => {
    const lines: {
      x1: number; y1: number; x2: number; y2: number;
      color: string; isSkill: boolean; t: number;
    }[] = [];
    if (now <= 0) return lines;
    for (const u of battle.units) {
      if (u.team !== side) continue;
      if (!u.lastAction?.time || now - u.lastAction.time > 1.2) continue;
      const target = getTarget(battle, u);
      if (!target || target.team === side) continue;

      // v3: 全局 DOM 坐标（跨面板正确）
      const srcRect = cellRectsRef.current.get(u.id);
      const dstRect = cellRectsRef.current.get(target.id);
      if (!srcRect || !dstRect) continue;
      const x1 = srcRect.x;
      const y1 = srcRect.y;
      const x2 = dstRect.x;
      const y2 = dstRect.y;

      const dmgType = u.lastDamage?.type || "physical";
      const color = DMG_ARROW_COLOR[dmgType] || DMG_ARROW_COLOR.physical;
      // v3: 仅技能攻击显示箭头（普攻不显示，避免杂乱）
      const isSkill = !!u.lastSkillCast && now - u.lastSkillCast.time < 0.9;
      if (!isSkill) continue;

      lines.push({ x1, y1, x2, y2, color, isSkill, t: u.lastSkillCast!.time });
    }
    // v3: 只显示最近的 2 条箭头
    lines.sort((a, b) => b.t - a.t);
    return lines.slice(0, 2);
  }, [battle.units, side, now]);

  const rowOrder =
    side === "ally"
      ? [Row.Back, Row.Mid, Row.Front]
      : [Row.Front, Row.Mid, Row.Back];

  return (
    <div
      ref={panelRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: 6,
        background:
          side === "ally"
            ? "linear-gradient(180deg, #1a237e33, #0d47a122)"
            : "linear-gradient(180deg, #b71c1c33, #880e4f22)",
        borderRadius: 10,
        border: isFinished
          ? `4px solid ${won ? "#4caf50" : "#f44336"}`
          : `1px solid ${side === "ally" ? "#1a237e44" : "#b71c1c44"}`,
        position: "relative",
      }}
    >
      {/* SVG overlay for attack arrows */}
      {/* v3: 攻击箭头已移除（技能演出流程内实现） */}

      {/* Result overlay */}
      {isFinished && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: 28,
            fontWeight: 900,
            zIndex: 10,
            color: won ? "#4caf50" : "#f44336",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            background: "rgba(0,0,0,0.75)",
            padding: "6px 24px",
            borderRadius: 8,
            border: `1px solid ${won ? "#4caf5055" : "#f4433655"}`,
          }}
        >
          {won ? "胜 利" : "败 北"}
        </div>
      )}

      {/* Team label */}
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: side === "ally" ? "#4fc3f7" : "#ef5350" }}>
        {side === "ally" ? "🟦 我方" : "🟥 敌方"}
      </div>

      {/* Active bonds */}
      {bonds.length > 0 && (
        <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", marginBottom: 2 }}>
          {bonds.map((b: any) => (
            <span key={b.race} style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: `${bondRC[b.race] || "#555"}33`,
              color: bondRC[b.race] || "#555",
              fontWeight: 700, border: `1px solid ${bondRC[b.race] || "#555"}55`,
            }}>
              {bondNM[b.race] || b.race}×{b.count}🌟
            </span>
          ))}
        </div>
      )}

      {/* v3: 实时战斗统计条 */}
      <div
        className="battle-stats"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-dim)",
          padding: "2px 4px 4px",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        <span>
          ☠️ 击杀{" "}
          <b style={{ color: "var(--text)" }}>
            {battle.units.filter((u) => u.team === side && u.isDead).length}
          </b>
          /{battle.units.filter((u) => u.team === side).length}
        </span>
        <span className="stat-dmg">
          ⚔ 总输出{" "}
          <b
            style={{
              color: "var(--accent)",
              fontWeight: 700,
            }}
          >
            {battle.stats
              ?.filter((s) => s.team === side)
              .reduce((a, s) => a + (s.totalDamageDealt || 0), 0)
              .toLocaleString()}
          </b>
        </span>
        <span>
          ⏱{" "}
          <b style={{ color: "var(--text)" }}>
            {battle.time.toFixed(1)}s
          </b>
        </span>
      </div>
      {/* 3×3 Grid */}
      {rowOrder.map((row) => (
        <div data-grid key={row} style={{ display: "flex", gap: 3, alignItems: "center", minHeight: CELL_H }}>
          <div style={{
            width: ROW_LABEL_W, fontSize: 9, color: "var(--text-dim)", fontWeight: 600,
            textAlign: "center", flexShrink: 0,
          }}>
            {ROW_NAMES[row]}
          </div>
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3,
          }}>
            {[0, 1, 2].map((col) => {
              const unit = grid[row][col];
              return unit ? (
                <div data-cell-id={unit.id} style={{ position: "relative" }} key={`${unit.id}-${unit.row}-${unit.col}`}>
                  {row === Row.Front && (
                    <div style={{
                      position: "absolute", top: -2, left: 2, fontSize: 8,
                      color: "#ffeb3b", zIndex: 2, fontWeight: 700,
                    }}>⚔</div>
                  )}
                  <UnitSprite
                    key={unit.id}
                    unit={unit}
                    onClick={() => onUnitClick?.(unit)}
                    focused={focusUnit?.id === unit.id}
                  />
                </div>
              ) : (
                <div key={`e-${row}-${col}`} style={{
                  height: 80, borderRadius: 8, display: "flex",
                  border: "1.5px dashed var(--panel-border)",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "var(--text-faint)",
                  background: "var(--slot-empty)",
                }}>空</div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BattleField;