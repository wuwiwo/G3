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
  // v3.4 R11: 一格可容纳多个单位（骷髅大帝 + 3 个骷髅兵同格）
  const grid = useMemo(() => {
    const g: ArenaUnit[][][] = [
      [[], [], []],
      [[], [], []],
      [[], [], []],
    ];
    for (const u of battle.units) {
      if (
        u.team === side &&
        u.row >= 0 &&
        u.row <= 2 &&
        u.col >= 0 &&
        u.col <= 2
      ) {
        g[u.row][u.col].push(u);
      }
    }
    // 非召唤物（本体）排前，避免被召唤物覆盖
    for (const row of g)
      for (const cell of row)
        cell.sort((a, b) => Number(!!a.isSummon) - Number(!!b.isSummon));
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
    const units = grid[row][col];
    const unit = units[0];
    if (!unit) {
      return (
        <div key={`e-${row}-${col}`} className="arena-empty">
          空
        </div>
      );
    }
    const extras = units.slice(1).filter((u) => u.isSummon);
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
        {extras.length > 0 && (
          <div
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            {extras.map((s) => {
              const pct = Math.max(
                0,
                Math.min(100, (s.currentHp / Math.max(1, s.maxHp)) * 100)
              );
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    fontSize: 9,
                    color: s.isDead ? "#777" : "#cfe8ff",
                    background: "rgba(10,14,22,.78)",
                    borderRadius: 3,
                    padding: "1px 3px",
                  }}
                >
                  <span>
                    {s.def.name}#{s.summonIndex ?? "?"}
                  </span>
                  <span
                    style={{
                      width: 22,
                      height: 3,
                      background: "#333",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${pct}%`,
                        background: s.isDead ? "#555" : "#5ecf8a",
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
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
