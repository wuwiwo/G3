import React, { useState, useCallback } from "react";
import { initBattle, processTick } from "../engine/battle";
import type { BattleState } from "../types";
import type { BattleStats } from "../types/stats";

interface Props {
  allyTeam: {
    charId: string;
    row: number;
    col: number;
    equipmentId?: string;
  }[];
  enemyTeam: {
    charId: string;
    row: number;
    col: number;
    equipmentId?: string;
  }[];
  onClose: () => void;
}

interface UnitAverages {
  name: string;
  race: string;
  team: string;
  totalDamage: number;
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  totalHealing: number;
  lifeStealHealing: number;
  skillHealing: number;
  damageTaken: number;
  kills: number;
  deaths: number;
  skillCasts: number;
  survivalTime: number;
  appearanceCount: number;
}

export const BatchTest: React.FC<Props> = ({
  allyTeam,
  enemyTeam,
  onClose,
}) => {
  const [runs, setRuns] = useState(50);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    allyWins: number;
    enemyWins: number;
    unitStats: Map<string, UnitAverages>;
  } | null>(null);

  const runTest = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setResults(null);

    let allyWins = 0;
    const unitAccum = new Map<string, { stat: UnitAverages; count: number }>();

    for (let i = 0; i < runs; i++) {
      const state = initBattle(allyTeam, enemyTeam) as unknown as BattleState;
      let safety = 0;
      while (state.phase === "fighting" && safety < 3000) {
        processTick(state as any);
        safety++;
      }

      if (state.winner === "ally") allyWins++;

      for (const s of (state as any).stats || []) {
        const u = state.units.find((x: any) => x.id === s.unitId);
        if (!u) continue;
        const key = u.def.id;
        const existing = unitAccum.get(key);
        const entry: UnitAverages = {
          name: u.def.name,
          race: u.def.race,
          team: u.team,
          totalDamage:
            (existing?.stat.totalDamage ?? 0) + (s.totalDamageDealt || 0),
          physicalDamage:
            (existing?.stat.physicalDamage ?? 0) + (s.physicalDamage || 0),
          magicalDamage:
            (existing?.stat.magicalDamage ?? 0) + (s.magicalDamage || 0),
          pureDamage: (existing?.stat.pureDamage ?? 0) + (s.pureDamage || 0),
          totalHealing:
            (existing?.stat.totalHealing ?? 0) + (s.totalHealingDone || 0),
          lifeStealHealing:
            (existing?.stat.lifeStealHealing ?? 0) + (s.lifeStealHealing || 0),
          skillHealing:
            (existing?.stat.skillHealing ?? 0) + (s.skillHealing || 0),
          damageTaken:
            (existing?.stat.damageTaken ?? 0) + (s.totalDamageReceived || 0),
          kills: (existing?.stat.kills ?? 0) + (s.kills || 0),
          deaths: (existing?.stat.deaths ?? 0) + (s.deaths || 0),
          skillCasts: (existing?.stat.skillCasts ?? 0) + (s.skillCasts || 0),
          survivalTime:
            (existing?.stat.survivalTime ?? 0) + (s.survivalTime || 0),
          appearanceCount: (existing?.count ?? 0) + 1,
        };
        unitAccum.set(key, { stat: entry, count: (existing?.count ?? 0) + 1 });
      }

      setProgress((prev) => prev + 1);
      if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const finalStats = new Map<string, UnitAverages>();
    for (const [key, { stat, count }] of unitAccum) {
      finalStats.set(key, {
        ...stat,
        totalDamage: Math.round(stat.totalDamage / runs),
        physicalDamage: Math.round(stat.physicalDamage / runs),
        magicalDamage: Math.round(stat.magicalDamage / runs),
        pureDamage: Math.round(stat.pureDamage / runs),
        totalHealing: Math.round(stat.totalHealing / runs),
        lifeStealHealing: Math.round(stat.lifeStealHealing / runs),
        skillHealing: Math.round(stat.skillHealing / runs),
        damageTaken: Math.round(stat.damageTaken / runs),
        kills: Math.round((stat.kills / runs) * 100) / 100,
        deaths: Math.round((stat.deaths / runs) * 100) / 100,
        skillCasts: Math.round((stat.skillCasts / runs) * 100) / 100,
        survivalTime: Math.round((stat.survivalTime / runs) * 100) / 100,
      });
    }

    setResults({
      allyWins,
      enemyWins: runs - allyWins,
      unitStats: finalStats,
    });
    setRunning(false);
  }, [allyTeam, enemyTeam, runs]);

  const unitList = results
    ? [...results.unitStats.entries()].sort(
        (a, b) => b[1].totalDamage - a[1].totalDamage
      )
    : [];

  const allyWinRate = results
    ? ((results.allyWins / runs) * 100).toFixed(1)
    : "0";
  const enemyWinRate = results
    ? ((results.enemyWins / runs) * 100).toFixed(1)
    : "0";

  return (
    <div
      style={{
        padding: "8px 10px 20px",
        maxWidth: 700,
        margin: "0 auto",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
          ⚙️ 批量测试
        </span>
        <button
          onClick={onClose}
          style={{
            padding: "4px 12px",
            background: "#333",
            color: "#ccc",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          关闭
        </button>
      </div>

      {/* Config */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ color: "#888" }}>对战次数：</span>
        <input
          type="number"
          value={runs}
          min={1}
          max={200}
          onChange={(e) =>
            setRuns(Math.max(1, Math.min(200, Number(e.target.value))))
          }
          style={{
            width: 60,
            padding: "4px 6px",
            background: "#1a1a2e",
            border: "1px solid #333",
            color: "#ddd",
            borderRadius: 4,
            fontSize: 11,
          }}
        />
        <button
          onClick={runTest}
          disabled={running}
          style={{
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 700,
            background: running ? "#333" : "#4caf50",
            color: running ? "#666" : "#000",
            border: "none",
            borderRadius: 6,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? `测试中 ${progress}/${runs}` : "开始测试"}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div
          style={{
            height: 6,
            background: "#1a1a2e",
            borderRadius: 3,
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(progress / runs) * 100}%`,
              height: "100%",
              background: "#4caf50",
              transition: "width 0.2s",
            }}
          />
        </div>
      )}

      {/* Results */}
      {results && (
        <div>
          {/* Win rate summary */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 8,
              padding: 8,
              background: "#111",
              borderRadius: 6,
            }}
          >
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#4fc3f7" }}>
                {allyWinRate}%
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>我方胜率</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#ef5350" }}>
                {enemyWinRate}%
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>敌方胜率</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
                {runs}
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>总场次</div>
            </div>
          </div>

          {/* Per-unit stats */}
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
            场均角色统计（按输出排序）：
          </div>
          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              background: "#111",
              borderRadius: 6,
              padding: 4,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
              }}
            >
              <thead>
                <tr style={{ color: "#666" }}>
                  <th style={{ padding: "2px 4px", textAlign: "left" }}>
                    角色
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    输出
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    物/魔/纯
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    承伤
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    治疗/吸血
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    击杀/死亡
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    存活
                  </th>
                </tr>
              </thead>
              <tbody>
                {unitList.map(([id, stat]) => {
                  const rc =
                    {
                      beast: "#8d6e63",
                      hunter: "#4caf50",
                      warrior: "#f44336",
                      mage: "#2196f3",
                      undead: "#9c27b0",
                      dragon: "#ff9800",
                    }[stat.race] || "#888";
                  return (
                    <tr
                      key={id}
                      style={{
                        borderBottom: "1px solid #1a1a2e",
                        color: stat.team === "ally" ? "#ccc" : "#999",
                      }}
                    >
                      <td style={{ padding: "2px 4px" }}>
                        <span
                          style={{
                            color: rc,
                            fontWeight: 600,
                            marginRight: 2,
                          }}
                        >
                          {stat.team === "ally" ? "🟦" : "🟥"}
                        </span>
                        {stat.name}
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "#f44336",
                        }}
                      >
                        {stat.totalDamage.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontSize: 9,
                        }}
                      >
                        <span style={{ color: "#ff5722" }}>
                          {stat.physicalDamage}
                        </span>
                        /
                        <span style={{ color: "#7c4dff" }}>
                          {stat.magicalDamage}
                        </span>
                        /
                        <span style={{ color: "#fff" }}>{stat.pureDamage}</span>
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          color: "#ff9800",
                        }}
                      >
                        {stat.damageTaken.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontSize: 9,
                        }}
                      >
                        <span style={{ color: "#4caf50" }}>
                          {stat.totalHealing}
                        </span>
                        /
                        <span style={{ color: "#e91e63" }}>
                          {stat.lifeStealHealing}
                        </span>
                      </td>
                      <td style={{ padding: "2px 4px", textAlign: "right" }}>
                        <span style={{ color: "#4caf50" }}>
                          {stat.kills.toFixed(1)}
                        </span>
                        /
                        <span style={{ color: "#f44336" }}>
                          {stat.deaths.toFixed(1)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          color: "#888",
                        }}
                      >
                        {stat.survivalTime.toFixed(1)}s
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
