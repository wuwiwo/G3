import React, { useMemo } from "react";
import { BattleState, Row, ROW_NAMES, ArenaUnit } from "../types";
import UnitSprite from "./UnitSprite";

interface Props {
  battle: BattleState;
  side: "ally" | "enemy";
  onUnitClick?: (unit: ArenaUnit) => void;
  focusUnit?: ArenaUnit | null;
  /** 默认横向对峙；vertical 为旧的上下堆叠布局（保留兼容） */
  layout?: "horizontal" | "vertical";
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

const BattleField: React.FC<Props> = ({
  battle,
  side,
  onUnitClick,
  focusUnit,
  layout = "horizontal",
}) => {
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
  const isHorizontal = layout === "horizontal";

  // 横向对峙：双方「前排」都朝中央，因此列的顺序互为镜像
  const columnOrder: Row[] =
    side === "ally"
      ? [Row.Back, Row.Mid, Row.Front]
      : [Row.Front, Row.Mid, Row.Back];

  const alive = battle.units.filter((u) => u.team === side && !u.isDead).length;
  const total = battle.units.filter((u) => u.team === side).length;
  const teamDamage =
    battle.stats
      ?.filter((s: any) => s.team === side)
      .reduce((a: number, s: any) => a + (s.totalDamageDealt || 0), 0) || 0;

  const renderCell = (row: Row, col: number) => {
    const unit = grid[row][col];
    if (!unit) {
      return (
        <div key={`e-${row}-${col}`} className="arena-empty">
          空
        </div>
      );
    }
    return (
      <div
        data-cell-id={unit.id}
        className="arena-cell"
        key={`${unit.id}-${unit.row}-${unit.col}`}
      >
        {row === Row.Front && <span className="front-marker">⚔</span>}
        <UnitSprite
          unit={unit}
          onClick={() => onUnitClick?.(unit)}
          focused={focusUnit?.id === unit.id}
        />
      </div>
    );
  };

  return (
    <div
      className={`side-panel side-${side} ${isHorizontal ? "side-horizontal" : "side-vertical"}`}
      style={{
        background:
          side === "ally"
            ? "linear-gradient(90deg, #0a1226 0%, #152a52 72%, #1c3c72 100%)"
            : "linear-gradient(90deg, #5c1626 0%, #431326 28%, #1a0a14 100%)",
        border: isFinished
          ? `3px solid ${won ? "#4caf50" : "#f44336"}`
          : `1px solid ${side === "ally" ? "#1a237e66" : "#b71c1c66"}`,
      }}
    >
      {isFinished && (
        <div
          className="side-result"
          style={{ color: won ? "#4caf50" : "#f44336" }}
        >
          {won ? "胜 利" : "败 北"}
        </div>
      )}

      <div
        className="side-title"
        style={{ color: side === "ally" ? "#4fc3f7" : "#ef5350" }}
      >
        {side === "ally" ? "◀ 我方" : "敌方 ▶"}
        <span className="side-alive">
          {alive}/{total}
        </span>
      </div>

      {bonds.length > 0 && (
        <div className="side-bonds">
          {bonds.map((b: any) => (
            <span
              key={b.race}
              style={{
                background: `${bondRC[b.race] || "#555"}33`,
                color: bondRC[b.race] || "#555",
                border: `1px solid ${bondRC[b.race] || "#555"}55`,
              }}
            >
              {bondNM[b.race] || b.race}×{b.count}
            </span>
          ))}
        </div>
      )}

      <div className="side-mini-stats">
        <span>
          ☠ <b>{total - alive}</b> 阵亡
        </span>
        <span>
          ⚔ <b>{teamDamage.toLocaleString()}</b> 输出
        </span>
      </div>

      {isHorizontal ? (
        <div data-grid className="arena-grid-horizontal">
          {columnOrder.map((row) => (
            <div
              className={`arena-col ${row === Row.Front ? "arena-front" : ""}`}
              key={row}
              data-arena-col={row}
            >
              <div className="arena-col-label">
                {row === Row.Front ? "⚔" : ""}
                {ROW_NAMES[row]}
              </div>
              {[0, 1, 2].map((col) => renderCell(row, col))}
            </div>
          ))}
        </div>
      ) : (
        <div data-grid className="arena-grid-vertical">
          {columnOrder.map((row) => (
            <div className="arena-row" key={row}>
              <div className="arena-row-label">{ROW_NAMES[row]}</div>
              <div className="arena-row-cells">
                {[0, 1, 2].map((col) => renderCell(row, col))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BattleField;
