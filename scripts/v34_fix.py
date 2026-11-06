#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""V3.4 缺陷修复 R7~R10 + 召唤物 R11 + 亡灵羁绊 R12（用户 2026-11-06 直发）。

用法: python scripts/v34_fix.py --step F1 [--dry-run]
设计源: ../docs/V3.4平衡性调整.md 第 8 节
F1 缺陷 / F2 护卫(引擎) / F3 复活debuff / F4 战场UI
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G3 = ROOT.parent
DRY = "--dry-run" in sys.argv
STEP = sys.argv[sys.argv.index("--step") + 1] if "--step" in sys.argv else None

BT = ROOT / "src/engine/battle.ts"
SR = ROOT / "src/engine/SkillRegistry.ts"
DMG = ROOT / "src/engine/damage.ts"
TY = ROOT / "src/types/index.ts"
RC = ROOT / "src/data/races.ts"
BF = ROOT / "src/components/BattleField.tsx"
V30 = G3 / "docs/v3.0.md"

# 直接选敌 filter -> 统一护卫入口（仅匹配「无额外条件」的常见写法）
ENEMY_FILTER = re.compile(
    r"(const|let)\s+(\w+)\s*=\s*state\.units\.filter\(\s*\((\w+)\s*:\s*any\)\s*=>\s*"
    r"\3\.team\s*!==\s*([\w.]+)\.team\s*&&\s*!\3\.isDead\s*\)",
    re.S,
)

STEPS = {
    "F1": ("缺陷 R7~R10", [
        (BT,
         "    const martyr = state.units.find(\n      (x: any) => x.team === u.team && x.def.id === \"xd\"\n    );",
         "    // v3.4 R7: 天赋只在殉道者存活时触发（技能阵亡后继续发动另见 updateMartyrPostmortem）\n    const martyr = state.units.find(\n      (x: any) => x.team === u.team && x.def.id === \"xd\" && !x.isDead\n    );"),
        (BT,
         "function deferDamage(target: any, dmg: number, state: any) {\n  if (dmg <= 0) return;",
         "function deferDamage(target: any, dmg: number, state: any) {\n  // v3.4 R8: 已阵亡单位不再承伤/累计挨打统计\n  if (target.isDead || dmg <= 0) return;"),
        (BT,
         "  for (const u of state.units) {\n    if (!u._delayedDamage || u._delayedDamage.length === 0) continue;",
         "  for (const u of state.units) {\n    // v3.4 R8: 延迟队列不对已阵亡单位结算\n    if (u.isDead) continue;\n    if (!u._delayedDamage || u._delayedDamage.length === 0) continue;"),
        (BT,
         "  state.time += 0.1;\n  setBattleClock(state.time);",
         "  state.time += 0.1;\n  setBattleClock(state.time);\n  // v3.4 R9: survivalTime 改为累计在场秒数（复活/阵亡期间不计）\n  for (const u of getAlive(state)) addStat(state, u.id, \"survivalTime\", 0.1);"),
        (BT,
         "    addStat(state, u.id, \"deaths\", 1);\n    addStat(state, u.id, \"survivalTime\", state.time);",
         "    addStat(state, u.id, \"deaths\", 1);\n    // v3.4 R9: 存活时长按 tick 累计，不再记绝对时刻"),
        (BT,
         "    state.winner = \"draw\";\n    for (const u of state.units) {\n      if (!u.isDead) addStat(state, u.id, \"survivalTime\", state.time);\n    }",
         "    state.winner = \"draw\";\n    // v3.4 R9: 存活时长按 tick 累计，超时结束不再补记"),
        (BT,
         "    // Record survival time for all alive units\n    for (const u of state.units) {\n      if (!u.isDead) addStat(state, u.id, \"survivalTime\", state.time);\n    }",
         "    // v3.4 R9: 存活时长按 tick 累计，胜负结束不再补记"),
        (BT,
         """  if (s && typeof s[field] === "number") {
    // v3.3-r5: survivalTime 记的是「时刻」而非「数量」。复活单位原本会被
    // updateDeaths 与 updateVictory 各记一次并累加，导致存活s > 战斗时长，
    // 进而让 10s 归一失真。改为覆盖取最后一次记录时刻。
    if (field === "survivalTime") s[field] = value;
    else s[field] += value;
  }""",
         """  // v3.4 R9: survivalTime 已是「累计在场秒数」，与其它统计一样普通累加
  if (s && typeof s[field] === "number") s[field] += value;"""),
        (BT,
         "      sk.isSummon = true;\n      sk.summonerId = kldd.id;",
         "      sk.isSummon = true;\n      sk.summonerId = kldd.id;\n      sk.summonIndex = i + 1; // v3.4 R10: 日志区分 3 个召唤物"),
        (BT,
         "  return `${u.team === \"ally\" ? \"🟦\" : \"🟥\"}[${tag}]${u.def.name}`;",
         "  // v3.4 R10: 召唤物带编号，避免「阵亡后还在打」的误读\n  const label = (u as any).summonIndex ? `${u.def.name}#${(u as any).summonIndex}` : u.def.name;\n  return `${u.team === \"ally\" ? \"🟦\" : \"🟥\"}[${tag}]${label}`;"),
        (TY,
         "  summonerId?: string;\n  isSummon?: boolean;",
         "  summonerId?: string;\n  isSummon?: boolean;\n  summonIndex?: number; // v3.4 R10: 召唤物日志编号\n  _guarded?: boolean;   // v3.4 R11: 被召唤物护卫中"),
    ]),
    "F2": ("骷髅大帝护卫 R11（引擎）", [
        (BT,
         """function getEnemies(
  state: BattleState,
  selfTeam: "ally" | "enemy"
): ArenaUnit[] {
  return state.units.filter((u) => u.team !== selfTeam && !u.isDead);
}""",
         """/** v3.4 R11: 骷髅大帝护卫 —— 召唤物全灭前本体不可被选为目标 */
export function getAttackableEnemies(
  state: any,
  selfTeam: "ally" | "enemy"
): any[] {
  // 返回 any[] 以保留原「state.units.filter((u:any)=>...)」的宽松度，
  // 避免把既有 handler 里被 any 掩盖的字段收紧成强类型后报错。
  return state.units.filter((u: any) => {
    if (u.team === selfTeam || u.isDead) return false;
    if (u.def.id !== "kldd") return true;
    return !state.units.some(
      (x: any) =>
        x.team === u.team &&
        x.isSummon &&
        x.summonerId === u.id &&
        !x.isDead
    );
  });
}

function getEnemies(
  state: BattleState,
  selfTeam: "ally" | "enemy"
): ArenaUnit[] {
  return getAttackableEnemies(state, selfTeam);
}"""),
        (BT,
         "  state.time += 0.1;\n  setBattleClock(state.time);\n  // v3.4 R9: survivalTime 改为累计在场秒数（复活/阵亡期间不计）\n  for (const u of getAlive(state)) addStat(state, u.id, \"survivalTime\", 0.1);",
         "  state.time += 0.1;\n  setBattleClock(state.time);\n  // v3.4 R9: survivalTime 改为累计在场秒数（复活/阵亡期间不计）\n  for (const u of getAlive(state)) addStat(state, u.id, \"survivalTime\", 0.1);\n  // v3.4 R11: 兜底标记，防止自带选敌逻辑的 handler 绕过护卫\n  for (const u of state.units) {\n    if (u.def.id === \"kldd\")\n      (u as any)._guarded = state.units.some(\n        (x: any) => x.team === u.team && x.isSummon && x.summonerId === u.id && !x.isDead\n      );\n  }"),
        (DMG,
         """  return result;
}

/** Apply Hell Hound fatal strike: independent from crit */""",
         """  // v3.4 R11 兜底: 被召唤物护卫的骷髅大帝不受任何伤害
  if ((defender as any)._guarded) {
    result.hit = false;
    result.finalDamage = 0;
  }

  return result;
}

/** Apply Hell Hound fatal strike: independent from crit */"""),
        (SR,
         'import { trackSkill } from "./battle";',
         'import { trackSkill, getAttackableEnemies } from "./battle";'),
    ]),
    "F3": ("亡灵羁绊复活 debuff R12", [
        (BT,
         "        u.hasRevived = true;",
         "        u.hasRevived = true;\n        // v3.4 R12: 复活后 15s 内造成伤害-25%、受到敌人伤害+25%\n        (u as any)._reviveDebuffUntil = state.time + 15;"),
        (BT,
         "          text: `🔄 ${u.def.name} 复活至${Math.round(reviveHpPct * 100)}%HP，技能进入冷却；${revDecayDelay}s后每秒失去${Math.round(revDecayPct * 100)}%最大HP`,",
         "          text: `🔄 ${u.def.name} 复活至${Math.round(reviveHpPct * 100)}%HP，技能进入冷却；${revDecayDelay}s后每秒失去${Math.round(revDecayPct * 100)}%最大HP；复活后15s内造成伤害-25%/受到伤害+25%`,"),
        (DMG,
         """  // v3.4 R11 兜底: 被召唤物护卫的骷髅大帝不受任何伤害
  if ((defender as any)._guarded) {
    result.hit = false;
    result.finalDamage = 0;
  }

  return result;""",
         """  // v3.4 R11 兜底: 被召唤物护卫的骷髅大帝不受任何伤害
  if ((defender as any)._guarded) {
    result.hit = false;
    result.finalDamage = 0;
  }
  // v3.4 R12: 复活后 15s debuff（输出-25% / 受伤+25%，可叠加）
  const nowDebuff = nowOf(extraOpts);
  if ((attacker as any)._reviveDebuffUntil && (attacker as any)._reviveDebuffUntil > nowDebuff)
    result.finalDamage = Math.floor(result.finalDamage * 0.75);
  if ((defender as any)._reviveDebuffUntil && (defender as any)._reviveDebuffUntil > nowDebuff)
    result.finalDamage = Math.floor(result.finalDamage * 1.25);

  return result;"""),
        (BT,
         "  // v3.4 R8: 已阵亡单位不再承伤/累计挨打统计\n  if (target.isDead || dmg <= 0) return;",
         "  // v3.4 R8: 已阵亡单位不再承伤/累计挨打统计\n  if (target.isDead || dmg <= 0) return;\n  // v3.4 R12: 复活 debuff 的受伤侧同样作用于延迟/DoT 伤害\n  if ((target as any)._reviveDebuffUntil && (target as any)._reviveDebuffUntil > state.time)\n    dmg = Math.floor(dmg * 1.25);"),
        (RC,
         '      special: "首次阵亡10s后复活至15%HP，2s后每秒失去3%最大HP(无法驱散)",',
         '      special: "首次阵亡10s后复活至15%HP，2s后每秒失去3%最大HP(无法驱散)+复活后15s造成伤害-25%/受伤+25%",'),
        (RC,
         '      special: "首次阵亡5s后复活至25%HP，3s后每秒失去2%最大HP(无法驱散)",',
         '      special: "首次阵亡5s后复活至25%HP，3s后每秒失去2%最大HP(无法驱散)+复活后15s造成伤害-25%/受伤+25%",'),
        (V30,
         "* 3 名:我方全部亡灵闪避率+10%，每个亡灵首次阵亡后,经过 10 s 后使那个亡灵复活并恢复至最大生命值×15%生命。经过 2 s 后，复活后的亡灵每秒失去最大生命值×3%生命（无法驱散）",
         "* 3 名:我方全部亡灵闪避率+10%，每个亡灵首次阵亡后,经过 10 s 后使那个亡灵复活并恢复至最大生命值×15%生命。经过 2 s 后，复活后的亡灵每秒失去最大生命值×3%生命（无法驱散）。**v3.4 R12：复活后 15s 内造成伤害-25%、受到敌人伤害+25%**"),
        (V30,
         "* 4 名:我方全部亡灵闪避率+20%，每个亡灵首次阵亡后,经过 5 s 后使那个亡灵复活并恢复至最大生命值×25%生命。经过 3 s 后，复活后的亡灵每秒失去最大生命值×2%生命（无法驱散）",
         "* 4 名:我方全部亡灵闪避率+20%，每个亡灵首次阵亡后,经过 5 s 后使那个亡灵复活并恢复至最大生命值×25%生命。经过 3 s 后，复活后的亡灵每秒失去最大生命值×2%生命（无法驱散）。**v3.4 R12：复活后 15s 内造成伤害-25%、受到敌人伤害+25%**"),
    ]),
    "F4": ("战场同时显示本体与召唤物 R11", [
        (BF,
         """  const grid = useMemo(() => {
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
  }, [battle.units, side]);""",
         """  // v3.4 R11: 一格可容纳多个单位（骷髅大帝 + 3 个骷髅兵同格）
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
  }, [battle.units, side]);"""),
        (BF,
         """  const renderCell = (row: Row, col: number) => {
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
  };""",
         """  const renderCell = (row: Row, col: number) => {
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
          <div style={{
            position: "absolute", right: 2, bottom: 2, display: "flex",
            flexDirection: "column", gap: 1, zIndex: 3, pointerEvents: "none",
          }}>
            {extras.map((s) => {
              const pct = Math.max(0, Math.min(100, (s.currentHp / Math.max(1, s.maxHp)) * 100));
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 2,
                  fontSize: 9, color: s.isDead ? "#777" : "#cfe8ff",
                  background: "rgba(10,14,22,.78)", borderRadius: 3, padding: "1px 3px",
                }}>
                  <span>{s.def.name}#{s.summonIndex ?? "?"}</span>
                  <span style={{
                    width: 22, height: 3, background: "#333", borderRadius: 2, overflow: "hidden",
                  }}>
                    <span style={{ display: "block", height: "100%", width: `${pct}%`, background: s.isDead ? "#555" : "#5ecf8a" }} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };"""),
    ]),
}


def read(p: Path) -> str:
    return p.read_bytes().decode("utf-8")


# 跨 step 共享内存镜像：全量 dry-run/执行时后一步能看到前一步的结果
CACHE: dict[Path, str] = {}


def apply(name: str) -> bool:
    title, patches = STEPS[name]
    print(f"\n--- {name}: {title} ---")
    cache = CACHE
    for p, old, new in patches:
        if p not in cache:
            cache[p] = read(p)
        c = cache[p]
        nl = "\r\n" if "\r\n" in c else "\n"
        o = old.replace("\n", nl) if nl != "\n" else old
        nw = new.replace("\n", nl) if nl != "\n" else new
        n = c.count(o)
        if n == 1:
            cache[p] = c.replace(o, nw, 1)
            print(f"  OK   {p.name}: {old[:54].replace(chr(10), ' ')}")
        elif n == 0 and c.count(nw) >= 1:
            print(f"  SKIP {p.name}: 已应用")
        else:
            print(f"  FAIL {p.name}: 命中 {n} 次 :: {old[:90]}")
            return False

    # F2 额外步骤：把两文件里「无额外条件的直接选敌」批量接入统一护卫过滤
    if name == "F2":
        for p in (BT, SR):
            c = cache.get(p, read(p))
            c, k = ENEMY_FILTER.subn(
                lambda m: f"{m.group(1)} {m.group(2)} = getAttackableEnemies(state, {m.group(4)}.team)",
                c,
            )
            cache[p] = c
            print(f"  BATCH {p.name}: 选敌接入 {k} 处")

    if not DRY:
        for p, s in cache.items():
            p.write_bytes(s.encode("utf-8"))
        print(f"  WROTE {len(cache)} files")
    else:
        print("  [--dry-run] 锚点全部通过，未写入")
    return True


targets = [STEP] if STEP else list(STEPS.keys())
for s in targets:
    if not apply(s):
        print(f"\n中止于 {s}（原子性）")
        sys.exit(1)
sys.exit(0)
