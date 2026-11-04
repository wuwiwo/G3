/**
 * 法师对局诊断 - 输出完整战斗日志
 * 运行: npx esbuild scripts/diagnoseMage.ts --bundle --platform=node --format=cjs --outfile=scripts/diagnoseMage.cjs && node scripts/diagnoseMage.cjs
 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const ROSTER: Record<string, string[]> = {
  beast: ["pp", "hl", "yl", "hx", "zzx", "dxm", "lbmx", "ds"],
  hunter: ["sszs", "bslr", "hqs", "mds", "zfyx", "lxgz", "xjlr", "xblr"],
  warrior: ["crzs", "hd", "fxz", "fdzs", "kzs", "slzs", "zqz", "jdds"],
  mage: ["xdds", "sjsn", "bmxz", "srm", "ynfs", "syz", "zs", "xjl"],
  undead: ["wqqs", "kldd", "yammxz", "dyq", "swxz", "wlgyz", "mrsz", "hyz"],
  dragon: ["hlyl", "bsxl", "xyfl", "hbfl", "bjl", "xcl", "dl", "lyz"],
};

function makeTeam(
  ids: string[]
): { charId: string; row: number; col: number }[] {
  const positions = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
  ];
  return ids.slice(0, 8).map((cid, i) => ({
    charId: cid,
    row: positions[i][0],
    col: positions[i][1],
  }));
}

function runBattle(ally: string[], enemy: string[], label: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`⚔️ ${label}`);
  console.log(`${"=".repeat(70)}`);

  const state = initBattle(
    makeTeam(ally) as any,
    makeTeam(enemy) as any
  ) as unknown as BattleState;

  let safety = 0;
  let lastLogIdx = 0;
  while (state.phase === "fighting" && safety < 3000) {
    processTick(state as any);
    safety++;
    // 打印关键事件（每 1s 聚合，输出技能/死亡/胜负）
    if (state.battleLog.length > lastLogIdx) {
      const newEntries = state.battleLog.slice(lastLogIdx);
      lastLogIdx = state.battleLog.length;
      for (const e of newEntries) {
        // 只打印关键日志：技能释放、死亡、复活、胜负、打断
        if (
          e.type === "skill" ||
          e.type === "death" ||
          e.type === "system" ||
          (e.type === "status" &&
            (e.text.includes("复活") ||
              e.text.includes("打断") ||
              e.text.includes("羁绊"))) ||
          e.type === "damage"
        ) {
          console.log(`[${e.time.toFixed(1)}s] ${e.text}`);
        }
      }
    }
  }

  // 终局统计
  console.log(
    `\n--- 战斗结束: ${state.winner === "ally" ? "法师胜" : "兽族/敌方胜"} (${state.time.toFixed(1)}s) ---`
  );
  for (const s of (state as any).stats || []) {
    const u = state.units.find((x: any) => x.id === s.unitId);
    if (!u) continue;
    console.log(
      `${u.team === "ally" ? "🟦" : "🟥"} ${u.def.name.padEnd(6)} 伤:${(s.totalDamageDealt || 0).toString().padStart(7)} 承:${(s.totalDamageReceived || 0).toString().padStart(7)} 治:${(s.totalHealingDone || 0).toString().padStart(5)} 击杀:${s.kills || 0} 死亡:${s.deaths || 0}`
    );
  }
}

// 法师 vs 兽族（法师 100% 输的对局）
runBattle(ROSTER.mage, ROSTER.beast, "法师 vs 兽族");

// 法师 vs 猎人（法师唯一有胜率的对局）
runBattle(ROSTER.mage, ROSTER.hunter, "法师 vs 猎人");
