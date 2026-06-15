import React, { useMemo } from "react";
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
};
const bondNM: Record<string, string> = {
  beast: "兽",
  hunter: "猎",
  warrior: "战",
  mage: "法",
  undead: "亡",
  dragon: "龙",
};

/** Find a unit's grid position (row,col) in the layout, considering row ordering */
function unitPos(
  u: ArenaUnit,
  side: "ally" | "enemy"
): { r: number; c: number; y: number } {
  const layoutRows =
    side === "ally"
      ? [Row.Back, Row.Mid, Row.Front]
      : [Row.Front, Row.Mid, Row.Back];
  const r = layoutRows.indexOf(u.row);
  // Approximate position in the battlefield: row (0-2) × cell height + half height
  return { r, c: u.col, y: r * 78 + 38 };
}

/** Get target unit on the other side, or null */
function getTarget(battle: BattleState, u: ArenaUnit): ArenaUnit | null {
  if (!u.lastHitTarget) return null;
  // Check both current and last hit target - the target might have moved
  const target = battle.units.find((x) => x.id === u.lastHitTarget);
  if (target && !target.isDead) return target;
  return null;
}

const BattleField: React.FC<Props> = ({
  battle,
  side,
  onUnitClick,
  focusUnit,
}) => {
  // Build fixed 3x3 grid from unit positions
  const grid = useMemo(() => {
    const g: (ArenaUnit | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    for (const u of battle.units) {
      if (
        u.team === side &&
        u.row >= 0 &&
        u.row <= 2 &&
        u.col >= 0 &&
        u.col <= 2
      ) {
        g[u.row][u.col] = u;
      }
    }
    return g;
  }, [battle.units, side]);

  const isFinished = battle.phase === "finished";
  const won = battle.winner === side;
  const bonds = battle.bonds?.[side] || [];
  const now = battle.time;

  // Find active attackers (recent attacks within 0.8s) and their targets
  const arrowLines = useMemo(() => {
    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];
    if (now <= 0) return lines;
    // Field dimensions: ally is left side, enemy is right side
    // Each cell is roughly 60px wide x 76px tall
    // The field has 3 rows with labels (~26px on left per row)
    for (const u of battle.units) {
      if (u.team !== side) continue;
      if (!u.lastAction?.time || now - u.lastAction.time > 0.8) continue;
      const target = getTarget(battle, u);
      if (!target || target.team === side) continue;
      // Compute positions relative to this field
      // Source position (within this field)
      const srcR =
        side === "ally"
          ? [Row.Back, Row.Mid, Row.Front].indexOf(u.row)
          : [Row.Front, Row.Mid, Row.Back].indexOf(u.row);
      const x1 = 26 + u.col * 60 + 30;
      const y1 = srcR * 78 + 38;
      // Target position (need to add field offset - ~340px gap between fields)
      const dstR =
        target.team === "ally"
          ? [Row.Back, Row.Mid, Row.Front].indexOf(target.row)
          : [Row.Front, Row.Mid, Row.Back].indexOf(target.row);
      // The other field is ~340px to the right (ally field) or left (enemy field)
      const fieldGap = side === "ally" ? 340 : -340;
      const x2 = 26 + target.col * 60 + 30 + fieldGap;
      const y2 = dstR * 78 + 38;
      lines.push({
        x1,
        y1,
        x2,
        y2,
        color: u.team === "ally" ? "#4fc3f7" : "#ef5350",
      });
    }
    return lines;
  }, [battle.units, side, now]);

  // Enemy rows are reversed for mirror layout
  const rowOrder =
    side === "ally"
      ? [Row.Back, Row.Mid, Row.Front]
      : [Row.Front, Row.Mid, Row.Back];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        background:
          side === "ally"
            ? "linear-gradient(180deg, #1a237e66, #0d47a133)"
            : "linear-gradient(180deg, #b71c1c66, #880e4f33)",
        borderRadius: 10,
        border: isFinished
          ? `4px solid ${won ? "#4caf50" : "#f44336"}`
          : "4px solid transparent",
        position: "relative",
      }}
    >
      {/* SVG overlay for attack arrows */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 5,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {arrowLines.map((line, i) => (
          <g key={i}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth={2}
              strokeOpacity={0.6}
              markerEnd={`url(#arrow${side})`}
            />
          </g>
        ))}
        <defs>
          <marker
            id={`arrow${side}`}
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={side === "ally" ? "#4fc3f7" : "#ef5350"}
              fillOpacity={0.6}
            />
          </marker>
        </defs>
      </svg>

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
            background: "rgba(0,0,0,0.7)",
            padding: "4px 20px",
            borderRadius: 8,
          }}
        >
          {won ? "胜利" : "败北"}
        </div>
      )}

      {/* Team label */}
      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#ccc",
        }}
      >
        {side === "ally" ? "我方" : "敌方"}
      </div>

      {/* Active bonds — read from engine, not computed in UI */}
      {bonds.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 3,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          {bonds.map((b: any) => (
            <span
              key={b.race}
              style={{
                fontSize: 8,
                padding: "1px 5px",
                borderRadius: 3,
                background: bondRC[b.race] || "#555",
                color: "#000",
                fontWeight: 700,
              }}
            >
              {bondNM[b.race] || b.race}×{b.count}🌟
            </span>
          ))}
        </div>
      )}

      {/* 3x3 Grid — fixed positions by (row, col) */}
      {rowOrder.map((row) => (
        <div
          key={row}
          style={{
            display: "flex",
            gap: 3,
            alignItems: "center",
            minHeight: 76,
          }}
        >
          <div
            style={{
              width: 26,
              fontSize: 10,
              color: "#666",
              fontWeight: 600,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            {ROW_NAMES[row]}
          </div>
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 3,
            }}
          >
            {[0, 1, 2].map((col) => {
              const unit = grid[row][col];
              return unit ? (
                <div
                  style={{ position: "relative" }}
                  key={`${unit.id}-${unit.row}-${unit.col}`}
                >
                  {row === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: 2,
                        fontSize: 7,
                        color: "#ffeb3b",
                        zIndex: 2,
                      }}
                    >
                      ⚔
                    </div>
                  )}
                  <UnitSprite
                    key={unit.id}
                    unit={unit}
                    onClick={() => onUnitClick?.(unit)}
                    focused={focusUnit?.id === unit.id}
                  />
                  {/* Show attack indicator */}
                  {unit.lastAction &&
                    !unit.lastAction.isTarget &&
                    now - unit.lastAction.time < 0.5 && (
                      <div
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#ffeb3b",
                          zIndex: 5,
                          animation: "pulse 0.5s infinite",
                        }}
                      />
                    )}
                  {/* Target indicator */}
                  {unit.lastAction?.isTarget &&
                    now - unit.lastAction.time < 0.5 && (
                      <div
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#f44336",
                          zIndex: 5,
                          animation: "pulse 0.5s infinite",
                        }}
                      />
                    )}
                </div>
              ) : (
                <div
                  key={`e-${row}-${col}`}
                  style={{
                    height: 74,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#333",
                    border: "1px dashed #2a2a3e",
                  }}
                >
                  空
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BattleField;
