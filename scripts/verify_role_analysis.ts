/** App 内置分析核心的端到端冒烟：3 局/对阵，验证结构与结论可产出。 */
import { analyzeAll } from "../src/lib/roleAnalysis";

(async () => {
  const r = await analyzeAll(
    3,
    () => {},
    () => false
  );
  if (!r) throw new Error("unexpected cancel");
  console.log(
    "battles",
    r.battles,
    "runs",
    r.runs,
    "avgDuration",
    r.avgDuration.toFixed(1)
  );
  console.log("rows", r.rows.length);
  console.log(
    "verdict",
    JSON.stringify(
      r.rows.reduce((a: any, x) => {
        a[x.verdict] = (a[x.verdict] || 0) + 1;
        return a;
      }, {})
    )
  );
  console.log("row keys", Object.keys(r.rows[0]).join(","));
  console.log(
    "overall",
    r.overall.map((o) => `${o.raceCN}:${o.pct.toFixed(0)}%`).join(" ")
  );
  console.log(
    "mirror",
    r.mirror.map((m) => `${m.raceCN}:${m.first.toFixed(0)}%`).join(" ")
  );
  console.log(
    "matchups",
    r.matchups.length,
    "sample",
    `${r.matchups[0].a} vs ${r.matchups[0].b} ${r.matchups[0].aPct.toFixed(0)}%`
  );
  console.log("insights", r.insights.length);
  for (const it of r.insights.slice(0, 4))
    console.log(`  [${it.kind}] ${it.title}: ${it.body.slice(0, 90)}`);
  const t = [...r.rows].sort((a, b) => b.total10 - a.total10)[0];
  console.log(
    "top",
    t.name,
    Math.round(t.total10),
    Math.round(t.value),
    "surv",
    t.surv.toFixed(1)
  );
  if (
    r.rows.length !== 56 ||
    r.battles !== 84 ||
    r.insights.length === 0 ||
    r.matchups.length !== 28
  )
    throw new Error("assertion failed");
  console.log("SMOKE_OK");
})();
