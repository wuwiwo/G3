import React, { useState, useCallback, useMemo } from "react";
import { initBattle, processTick } from "../engine/battle";
import { CHARACTER_MAP, ALL_CHARACTERS } from "../data/characters";
import { RACE_NAMES } from "../types";
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
  physDmgTaken: number;
  magDmgTaken: number;
  pureDmgTaken: number;
  kills: number;
  deaths: number;
  skillCasts: number;
  survivalTime: number;
  appearanceCount: number;
}

type SortField = keyof UnitAverages;
const SORTABLE: { key: SortField; label: string }[] = [
  { key: "totalDamage", label: "输出" },
  { key: "damageTaken", label: "承伤" },
  { key: "physDmgTaken", label: "承物" },
  { key: "magDmgTaken", label: "承魔" },
  { key: "pureDmgTaken", label: "承纯" },
  { key: "totalHealing", label: "治疗" },
  { key: "lifeStealHealing", label: "吸血" },
  { key: "kills", label: "击杀" },
  { key: "deaths", label: "死亡" },
  { key: "survivalTime", label: "存活" },
  { key: "skillCasts", label: "技能" },
];

const RC: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
};

export const BatchTest: React.FC<Props> = ({
  allyTeam,
  enemyTeam,
  onClose,
}) => {
  const [runs, setRuns] = useState(50);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sortField, setSortField] = useState<SortField>("totalDamage");
  const [sortAsc, setSortAsc] = useState(false);
  const [results, setResults] = useState<{
    allyWins: number;
    enemyWins: number;
    unitStats: Map<string, UnitAverages>;
    skillStats: Map<string, any>;
  } | null>(null);

  const runTest = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setResults(null);

    let allyWins = 0;
    const unitAccum = new Map<string, { stat: UnitAverages; count: number }>();
    const skillAccum = new Map<string, any>();

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
          physDmgTaken:
            (existing?.stat.physDmgTaken ?? 0) +
            (s.physicalDamageReceived || 0),
          magDmgTaken:
            (existing?.stat.magDmgTaken ?? 0) + (s.magicalDamageReceived || 0),
          pureDmgTaken:
            (existing?.stat.pureDmgTaken ?? 0) + (s.pureDamageReceived || 0),
          kills: (existing?.stat.kills ?? 0) + (s.kills || 0),
          deaths: (existing?.stat.deaths ?? 0) + (s.deaths || 0),
          skillCasts: (existing?.stat.skillCasts ?? 0) + (s.skillCasts || 0),
          survivalTime:
            (existing?.stat.survivalTime ?? 0) + (s.survivalTime || 0),
          appearanceCount: (existing?.count ?? 0) + 1,
        };
        unitAccum.set(key, { stat: entry, count: (existing?.count ?? 0) + 1 });
      }
      // Accumulate skill stats
      if ((state as any).skillStats) {
        for (const [skey, sv] of Object.entries((state as any).skillStats)) {
          const ss = sv as any;
          const u = state.units.find((x: any) => x.id === ss.ownerId);
          const existing = skillAccum.get(skey);
          skillAccum.set(skey, {
            skillName: ss.skillName,
            ownerId: ss.ownerId,
            ownerName: u?.def.name || "?",
            casts: (existing?.casts ?? 0) + ss.casts,
            totalDamage: (existing?.totalDamage ?? 0) + ss.totalDamage,
            physDmg: (existing?.physDmg ?? 0) + ss.physDmg,
            magDmg: (existing?.magDmg ?? 0) + ss.magDmg,
            pureDmg: (existing?.pureDmg ?? 0) + ss.pureDmg,
          });
        }
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
        physDmgTaken: Math.round(stat.physDmgTaken / runs),
        magDmgTaken: Math.round(stat.magDmgTaken / runs),
        pureDmgTaken: Math.round(stat.pureDmgTaken / runs),
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
      skillStats: skillAccum,
    });
    setRunning(false);
  }, [allyTeam, enemyTeam, runs]);

  const unitList = useMemo(() => {
    if (!results) return [];
    const dir = sortAsc ? 1 : -1;
    return [...results.unitStats.entries()].sort((a, b) => {
      const va = a[1][sortField] ?? 0;
      const vb = b[1][sortField] ?? 0;
      return typeof va === "number" && typeof vb === "number"
        ? (va - vb) * dir
        : 0;
    });
  }, [results, sortField, sortAsc]);

  const allyWinRate = results
    ? ((results.allyWins / runs) * 100).toFixed(1)
    : "0";
  const enemyWinRate = results
    ? ((results.enemyWins / runs) * 100).toFixed(1)
    : "0";

  const copyBatchResults = () => {
    if (!results || !unitList.length) return;
    const lines: string[] = [];
    lines.push(
      `胜率\t我方${allyWinRate}%\t敌方${enemyWinRate}%\t总场次${runs}`
    );
    lines.push("");
    lines.push(
      "角色\t种族\t队伍\t输出\t物伤\t魔伤\t纯粹\t承伤\t承物\t承魔\t承纯\t治疗\t技能治疗\t吸血\t击杀\t死亡\t技能\t存活(s)"
    );
    for (const [, stat] of unitList) {
      lines.push(
        [
          stat.name,
          stat.race,
          stat.team,
          stat.totalDamage,
          stat.physicalDamage,
          stat.magicalDamage,
          stat.pureDamage,
          stat.damageTaken,
          stat.physDmgTaken,
          stat.magDmgTaken,
          stat.pureDmgTaken,
          stat.totalHealing,
          stat.skillHealing,
          stat.lifeStealHealing,
          stat.kills.toFixed(1),
          stat.deaths.toFixed(1),
          stat.skillCasts.toFixed(1),
          stat.survivalTime.toFixed(1),
        ].join("\t")
      );
    }
    // Skill stats
    if (results.skillStats && results.skillStats.size > 0) {
      lines.push("");
      lines.push("=== 技能统计(场均) ===");
      lines.push("角色\t技能\t次数\t总伤\t物伤\t魔伤\t纯粹");
      for (const [, sv] of results.skillStats.entries()) {
        const s = sv as any;
        lines.push(
          [
            s.ownerName || "?",
            s.skillName,
            Math.round(s.casts / runs),
            Math.round(s.totalDamage / runs),
            Math.round(s.physDmg / runs),
            Math.round(s.magDmg / runs),
            Math.round(s.pureDmg / runs),
          ].join("\t")
        );
      }
    }
    navigator.clipboard.writeText(lines.join("\n"));
  };

  const exportPanel = () => {
    const rows = [
      [
        "id",
        "name",
        "race",
        "hp",
        "atk",
        "pDef",
        "mDef",
        "atkInterval",
        "growthHP",
        "growthATK",
        "growthPDEF",
        "growthMDEF",
        "talent",
        "skillId",
        "skillCD",
        "skillCastTime",
      ],
    ];
    for (const c of ALL_CHARACTERS) {
      rows.push([
        c.id,
        c.name,
        RACE_NAMES[c.race] || c.race,
        String(c.stats.hp),
        String(c.stats.attack),
        String(c.stats.physicalDef),
        String(c.stats.magicalDef),
        String(c.stats.attackInterval),
        String(c.growth.hp),
        String(c.growth.attack),
        String(c.growth.physicalDef),
        String(c.growth.magicalDef),
        `"${c.talent.replace(/"/g, '""')}"`,
        c.skill.id,
        String(c.skill.cooldown),
        String(c.skill.castTime),
      ]);
    }
    navigator.clipboard.writeText(rows.map((r) => r.join(",")).join("\n"));
  };

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

          <div
            style={{
              display: "flex",
              gap: 4,
              justifyContent: "flex-end",
              marginBottom: 4,
            }}
          >
            <button
              onClick={exportPanel}
              style={{
                padding: "3px 8px",
                fontSize: 9,
                fontWeight: 600,
                background: "#222",
                color: "#aaa",
                border: "1px solid #333",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              导出角色面板
            </button>
            <button
              onClick={copyBatchResults}
              style={{
                padding: "3px 8px",
                fontSize: 9,
                fontWeight: 600,
                background: "#222",
                color: "#aaa",
                border: "1px solid #333",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              复制全部结果
            </button>
          </div>

          {/* Team composition */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 6,
              padding: 6,
              background: "#111",
              borderRadius: 6,
              fontSize: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{ color: "#4fc3f7", fontWeight: 600, marginBottom: 2 }}
              >
                我方
              </div>
              {allyTeam.map((u) => {
                const ch = CHARACTER_MAP.get(u.charId);
                if (!ch) return null;
                return (
                  <div
                    key={u.charId}
                    style={{ color: "#ccc", padding: "1px 0" }}
                  >
                    <span style={{ color: RC[ch.race] || "#888" }}>■</span>{" "}
                    {ch.name}
                  </div>
                );
              })}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{ color: "#ef5350", fontWeight: 600, marginBottom: 2 }}
              >
                敌方
              </div>
              {enemyTeam.map((u) => {
                const ch = CHARACTER_MAP.get(u.charId);
                if (!ch) return null;
                return (
                  <div
                    key={u.charId}
                    style={{ color: "#999", padding: "1px 0" }}
                  >
                    <span style={{ color: RC[ch.race] || "#888" }}>■</span>{" "}
                    {ch.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-unit stats */}
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
            场均角色统计（点击列头排序）：
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
                  {SORTABLE.map((s) => (
                    <th
                      key={s.key}
                      onClick={() => {
                        if (sortField === s.key) setSortAsc(!sortAsc);
                        else {
                          setSortField(s.key);
                          setSortAsc(false);
                        }
                      }}
                      style={{
                        padding: "2px 4px",
                        textAlign: "right",
                        cursor: "pointer",
                        color: sortField === s.key ? "#4a9eff" : "#666",
                        fontWeight: sortField === s.key ? 700 : 400,
                        userSelect: "none",
                      }}
                    >
                      {s.label}
                      {sortField === s.key ? (sortAsc ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    伤类(出)
                  </th>
                  <th style={{ padding: "2px 4px", textAlign: "right" }}>
                    伤类(受)
                  </th>
                </tr>
              </thead>
              <tbody>
                {unitList.map(([id, stat]) => {
                  const rc = RC[stat.race] || "#888";
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
                      {SORTABLE.map((s) => (
                        <td
                          key={s.key}
                          style={{
                            padding: "2px 4px",
                            textAlign: "right",
                            fontWeight: s.key === "totalDamage" ? 600 : 400,
                            color:
                              s.key === "totalDamage"
                                ? "#f44336"
                                : s.key === "damageTaken"
                                  ? "#ff9800"
                                  : s.key === "totalHealing" ||
                                      s.key === "skillHealing"
                                    ? "#4caf50"
                                    : s.key === "lifeStealHealing"
                                      ? "#e91e63"
                                      : s.key === "kills"
                                        ? "#4caf50"
                                        : s.key === "deaths"
                                          ? "#f44336"
                                          : "#888",
                            fontSize: s.key === "skillCasts" ? 9 : 10,
                          }}
                        >
                          {typeof stat[s.key] === "number"
                            ? (stat[s.key] as number) > 100
                              ? (stat[s.key] as number).toLocaleString()
                              : (stat[s.key] as number).toFixed(1)
                            : stat[s.key]}
                          {s.key === "survivalTime" ? "s" : ""}
                        </td>
                      ))}
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
                          fontSize: 9,
                        }}
                      >
                        <span style={{ color: "#ff5722" }}>
                          {stat.physDmgTaken}
                        </span>
                        /
                        <span style={{ color: "#7c4dff" }}>
                          {stat.magDmgTaken}
                        </span>
                        /
                        <span style={{ color: "#fff" }}>
                          {stat.pureDmgTaken}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Skill breakdown */}
          {results.skillStats && results.skillStats.size > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>
                技能统计（场均）：
              </div>
              <div
                style={{
                  maxHeight: 200,
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
                    fontSize: 9,
                  }}
                >
                  <thead>
                    <tr style={{ color: "#555" }}>
                      <th style={{ padding: "1px 3px", textAlign: "left" }}>
                        角色
                      </th>
                      <th style={{ padding: "1px 3px", textAlign: "left" }}>
                        技能
                      </th>
                      <th style={{ padding: "1px 3px", textAlign: "right" }}>
                        次数
                      </th>
                      <th style={{ padding: "1px 3px", textAlign: "right" }}>
                        总伤
                      </th>
                      <th style={{ padding: "1px 3px", textAlign: "right" }}>
                        物/魔/纯
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...results.skillStats.entries()]
                      .sort(
                        (a, b) =>
                          (b[1] as any).totalDamage - (a[1] as any).totalDamage
                      )
                      .map(([skey, sv]: [string, any]) => {
                        return (
                          <tr
                            key={skey}
                            style={{ borderBottom: "1px solid #1a1a2e" }}
                          >
                            <td style={{ padding: "1px 3px", color: "#ccc" }}>
                              {sv.ownerName || "?"}
                            </td>
                            <td style={{ padding: "1px 3px", color: "#aaa" }}>
                              {sv.skillName}
                            </td>
                            <td
                              style={{
                                padding: "1px 3px",
                                textAlign: "right",
                                color: "#888",
                              }}
                            >
                              {Math.round(sv.casts / runs)}
                            </td>
                            <td
                              style={{
                                padding: "1px 3px",
                                textAlign: "right",
                                color: "#f44336",
                              }}
                            >
                              {Math.round(sv.totalDamage / runs)}
                            </td>
                            <td
                              style={{ padding: "1px 3px", textAlign: "right" }}
                            >
                              <span style={{ color: "#ff5722" }}>
                                {Math.round(sv.physDmg / runs)}
                              </span>
                              /
                              <span style={{ color: "#7c4dff" }}>
                                {Math.round(sv.magDmg / runs)}
                              </span>
                              /
                              <span style={{ color: "#fff" }}>
                                {Math.round(sv.pureDmg / runs)}
                              </span>
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
      )}
    </div>
  );
};
