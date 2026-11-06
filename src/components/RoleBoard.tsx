import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  analyzeAll,
  RACE_CN,
  type AnalysisResult,
  type RoleRow,
} from "../lib/roleAnalysis";

interface Props {
  onClose: () => void;
}

type View = "over" | "out" | "gain" | "live";
const VIEWS: { key: View; label: string }[] = [
  { key: "over", label: "总览" },
  { key: "out", label: "输出分轨" },
  { key: "gain", label: "收益分轨" },
  { key: "live", label: "生存/承伤" },
];

interface Col {
  k: keyof RoleRow;
  t: string;
  g: View[];
  dec?: boolean;
}
// 列顺序对齐用户 2026-11-06 截图：角色 | 种族 | 总贡献 | 总输出 | 10s输出 | 普攻 | 技能 | 其他 | 天赋归因 | 占全场%
const COLS: Col[] = [
  { k: "name", t: "角色", g: ["over", "out", "gain", "live"] },
  { k: "raceCN", t: "种族", g: ["over", "out", "gain", "live"] },
  { k: "value", t: "总贡献", g: ["over", "out", "gain"] },
  { k: "out", t: "总输出", g: ["over", "out"] },
  { k: "out10", t: "10s输出", g: ["over", "out"] },
  { k: "auto", t: "普攻", g: ["over", "out"] },
  { k: "skill", t: "技能", g: ["over", "out"] },
  { k: "other", t: "其他", g: ["over", "out"] },
  { k: "talent", t: "天赋归因", g: ["over", "out"] },
  { k: "outShare", t: "占全场%", g: ["over", "out"], dec: true },
  { k: "verdict", t: "判定", g: ["over"] },
  { k: "total10", t: "10s综合", g: ["over", "gain"] },
  { k: "gain", t: "收益合计", g: ["over", "gain"] },
  { k: "gain10", t: "10s收益", g: ["over", "gain"] },
  { k: "heal", t: "治疗", g: ["gain"] },
  { k: "ls", t: "吸血", g: ["gain"] },
  { k: "skillHeal", t: "技能治疗", g: ["gain"] },
  { k: "shield", t: "护盾吸收", g: ["gain"] },
  { k: "block", t: "格挡减伤", g: ["gain"] },
  { k: "buff", t: "增益点·秒", g: ["gain"] },
  { k: "ctrl", t: "控制s", g: ["gain"], dec: true },
  { k: "surv", t: "存活s", g: ["over", "live"], dec: true },
  { k: "taken", t: "承伤", g: ["live"] },
  { k: "kills", t: "击杀", g: ["live"], dec: true },
  { k: "deaths", t: "死亡", g: ["live"], dec: true },
  { k: "casts", t: "技能释放", g: ["live"], dec: true },
];

const CACHE_KEY = "g3_role_board_cache_v1";
const fmt = (v: number) => Math.round(v || 0).toLocaleString("en-US");
const num = (v: any, dec?: boolean) =>
  typeof v === "number" ? (dec ? v.toFixed(1) : fmt(v)) : String(v ?? "");

const btn: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: "var(--font-sm)",
};

export const RoleBoard: React.FC<Props> = ({ onClose }) => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [runs, setRuns] = useState(30);
  const [view, setView] = useState<View>("over");
  const [race, setRace] = useState("");
  const [verdict, setVerdict] = useState("");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof RoleRow>("total10");
  const [sortDir, setSortDir] = useState(-1);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async (n: number) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    setElapsed(0);
    const t0 = Date.now();
    try {
      const r = await analyzeAll(
        n,
        (p, label) => {
          setProgress(p);
          setStage(label);
        },
        () => cancelRef.current
      );
      setElapsed((Date.now() - t0) / 1000);
      if (r) {
        setResult(r);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(r));
        } catch {
          /* 配额满则忽略 */
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      setStage("");
    }
  }, []);

  // 内置自动计算：有缓存秒开，否则自动跑一轮默认 30 局
  useEffect(() => {
    let cached: AnalysisResult | null = null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) cached = JSON.parse(raw) as AnalysisResult;
    } catch {
      /* ignore */
    }
    if (cached?.rows?.length) setResult(cached);
    else void start(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cols = useMemo(() => COLS.filter((c) => c.g.includes(view)), [view]);
  const list = useMemo(() => {
    if (!result) return [];
    return result.rows
      .filter(
        (r) =>
          (!race || r.raceCN === race) &&
          (!verdict || r.verdict === verdict) &&
          (!q || r.name.includes(q))
      )
      .sort((a, b) => {
        const x = a[sortKey],
          y = b[sortKey];
        if (typeof x === "string" || typeof y === "string")
          return String(x).localeCompare(String(y)) * sortDir;
        return ((x as number) - (y as number)) * sortDir;
      });
  }, [result, race, verdict, q, sortKey, sortDir]);

  const overCount =
    result?.rows.filter((r) => r.verdict === "超模").length ?? 0;
  const underCount =
    result?.rows.filter((r) => r.verdict === "待加强").length ?? 0;
  const top = result
    ? [...result.rows].sort((a, b) => b.total10 - a.total10)[0]
    : null;

  const exportCsv = () => {
    if (!result) return;
    const lines = [cols.map((c) => c.t).join(",")].concat(
      list.map((r) =>
        cols
          .map((c) =>
            typeof r[c.k] === "number"
              ? (r[c.k] as number).toFixed(2)
              : String(r[c.k])
          )
          .join(",")
      )
    );
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `G3_roles_${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kindColor = (k: string) =>
    k === "critical" ? "#e05c55" : k === "warn" ? "#d9a441" : "#5e9eff";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--bg)",
        overflow: "auto",
        padding: "16px 18px 70px",
        color: "var(--text)",
        fontSize: "var(--font-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h2
          style={{ margin: 0, fontSize: "var(--font-title)", fontWeight: 500 }}
        >
          角色细颗粒度看板
        </h2>
        <span
          style={{
            color: "#5e9eff",
            border: "1px solid var(--panel-border)",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: "var(--font-xs)",
          }}
        >
          GDD v3.4 · App v2.2
        </span>
        <span style={{ color: "var(--text-dim)" }}>
          {result
            ? `${result.generated} · ${result.runs} 局/对阵 · ${result.battles} 场 · 平均 ${result.avgDuration.toFixed(1)}s`
            : "正在计算…"}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            disabled={running}
            style={btn}
          >
            <option value={10}>10 局（快）</option>
            <option value={30}>30 局（默认）</option>
            <option value={100}>100 局（正式）</option>
            <option value={150}>150 局（收敛）</option>
          </select>
          <button
            style={btn}
            disabled={running}
            onClick={() => void start(runs)}
          >
            重新分析
          </button>
          {running && (
            <button
              style={btn}
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              取消
            </button>
          )}
          <button style={btn} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {running && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 6,
              background: "var(--panel)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(progress * 100).toFixed(1)}%`,
                background: "#5e9eff",
                transition: "width .15s",
              }}
            />
          </div>
          <div style={{ color: "var(--text-dim)", marginTop: 4 }}>
            {(progress * 100).toFixed(0)}% · {stage} ·
            分片让出主线程，界面可继续操作
          </div>
        </div>
      )}
      {!running && elapsed > 0 && (
        <div style={{ color: "var(--text-dim)", marginBottom: 10 }}>
          本次计算耗时 {elapsed.toFixed(1)}s，结果已缓存到本地
        </div>
      )}

      {result && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {[
              ["角色数", String(result.rows.length), "var(--text)"],
              ["疑似超模", String(overCount), "#e05c55"],
              ["待加强", String(underCount), "#5e9eff"],
              [
                "10s综合最高",
                top ? `${top.name} ${fmt(top.total10)}` : "—",
                "var(--text)",
              ],
            ].map(([label, value, color]) => (
              <div
                key={label}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 10,
                  padding: "8px 14px",
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    color: "var(--text-dim)",
                    fontSize: "var(--font-xs)",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 500, color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              自动分析结论（规则派生，无 AI 调用）
            </div>
            {result.insights.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 7,
                  lineHeight: 1.6,
                }}
              >
                <span style={{ color: kindColor(it.kind), flexShrink: 0 }}>
                  ●
                </span>
                <span>
                  <b style={{ fontWeight: 500, color: kindColor(it.kind) }}>
                    {it.title}
                  </b>{" "}
                  — {it.body}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 8 }}>综合胜率</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {result.overall.map((o) => (
                <span key={o.race} style={{ minWidth: 92 }}>
                  <span style={{ color: "var(--text-dim)" }}>{o.raceCN} </span>
                  <b style={{ fontWeight: 500 }}>{o.pct.toFixed(1)}%</b>
                  <span
                    style={{
                      display: "block",
                      height: 4,
                      background: "var(--bg)",
                      borderRadius: 2,
                      marginTop: 3,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${o.pct}%`,
                        background: "#5e9eff",
                        borderRadius: 2,
                      }}
                    />
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              胜率对局明细（21 组对阵 + 7 组镜像 · 判定 58/42 阈值）
            </div>
            <div
              style={{
                overflow: "auto",
                maxHeight: 220,
                border: "1px solid var(--panel-border)",
                borderRadius: 8,
              }}
            >
              <table
                id="g3-matchup-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <thead>
                  <tr>
                    {["对局", "A 胜率", "B 胜率", "判定"].map((h) => (
                      <th
                        key={h}
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "var(--panel)",
                          padding: "6px 10px",
                          textAlign: h === "对局" ? "left" : "right",
                          borderBottom: "1px solid var(--panel-border)",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.matchups || []).map((m, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid var(--panel-border)" }}
                    >
                      <td style={{ padding: "5px 10px" }}>
                        {m.a} vs {m.b}
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "right" }}>
                        {m.aPct.toFixed(1)}%
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "right" }}>
                        {m.bPct.toFixed(1)}%
                      </td>
                      <td
                        style={{
                          padding: "5px 10px",
                          textAlign: "right",
                          color:
                            m.verdict === "碾压"
                              ? "#e05c55"
                              : m.verdict === "被克"
                                ? "#5e9eff"
                                : "var(--text-dim)",
                        }}
                      >
                        {m.verdict}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                border: "1px solid var(--panel-border)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  style={{
                    ...btn,
                    border: "none",
                    borderRadius: 0,
                    background: view === v.key ? "#5e9eff" : "var(--panel)",
                    color: view === v.key ? "#fff" : "var(--text)",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <select
              value={race}
              onChange={(e) => setRace(e.target.value)}
              style={btn}
            >
              <option value="">全部种族</option>
              {Object.values(RACE_CN).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              style={btn}
            >
              <option value="">全部判定</option>
              <option value="超模">超模</option>
              <option value="待加强">待加强</option>
              <option value="正常">正常</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索角色"
              style={{ ...btn, width: 120 }}
            />
            <button onClick={exportCsv} style={btn}>
              导出 CSV
            </button>
            <span style={{ color: "var(--text-dim)", marginLeft: "auto" }}>
              {list.length} / {result.rows.length} 个角色 · 点表头排序
            </span>
          </div>

          <div
            style={{
              color: "var(--text-dim)",
              marginBottom: 8,
              lineHeight: 1.6,
            }}
          >
            口径：普攻/技能/其他为来源分轨；天赋伤害为归因分轨（重叠、不可相加）。收益合计
            = 治疗 + 护盾 + 格挡；增益/控制为不同度量衡，不并入合计。 存活s
            为累计在场秒数（v3.4
            R9，阵亡/复活等待期间不计）。短存活或「阵亡后仍可施法」会放大
            10s归一，请结合总贡献交叉看。
          </div>

          <div
            style={{
              overflow: "auto",
              maxHeight: "52vh",
              border: "1px solid var(--panel-border)",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                width: "100%",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th
                      key={c.k}
                      onClick={() => {
                        if (sortKey === c.k) setSortDir(-sortDir);
                        else {
                          setSortKey(c.k);
                          setSortDir(-1);
                        }
                      }}
                      style={{
                        position: "sticky",
                        top: 0,
                        background: "var(--panel)",
                        padding: "7px 10px",
                        textAlign: "left",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid var(--panel-border)",
                        fontWeight: 500,
                      }}
                    >
                      {c.t}
                      {sortKey === c.k ? (sortDir < 0 ? " ↓" : " ↑") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.name}>
                    {cols.map((c) => (
                      <td
                        key={c.k}
                        style={{
                          padding: "6px 10px",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid var(--panel-border)",
                          textAlign:
                            typeof r[c.k] === "number" ? "right" : "left",
                        }}
                      >
                        {c.k === "verdict" ? (
                          <span
                            style={{
                              color:
                                r.verdict === "超模"
                                  ? "#e05c55"
                                  : r.verdict === "待加强"
                                    ? "#5e9eff"
                                    : "var(--text-dim)",
                            }}
                          >
                            {r.verdict === "超模"
                              ? "● 超模"
                              : r.verdict === "待加强"
                                ? "● 待加强"
                                : "○ 正常"}
                          </span>
                        ) : (
                          num(r[c.k], c.dec)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
