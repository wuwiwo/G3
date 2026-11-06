"""v3.3 第三轮：继续补齐 P0 引擎缺陷。

用法: python scripts/v33_apply_p0b.py [--dry-run]

本次修复:
  1. 圣职者反制直接修改 caster.def.skill.effects（跨对局共享对象），
     导致 duration/value 每次被反制都永久衰减，批量测试中逐场变弱 —— 最严重。
  2. state._warriorTimer 为全局单值且在循环内清零，敌我共享、
     只有第一个战士能恢复 —— 造成战士镜像 66% 的对称性偏差。
  3. clearBuffsOnEnd 在 for...of 遍历中重赋值 unit.statuses（逻辑不稳定）。
  4. 亡灵歌咏者 effects 复用 heal 的 aoe.maxTargets=2，诅咒 2 名而非文档的 1 名。
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
BATTLE = BASE / "src" / "engine" / "battle.ts"
DRY = "--dry-run" in sys.argv

HOLY_OLD = """    // v3.0 圣职者羁绊: 增益/控制削弱+镜像
    if ((caster as any)._holySuppress && (sk.tags?.includes("增益") || sk.tags?.includes("控制"))) {
      const sp = (caster as any)._holySuppress;
      for (const eff of sk.effects) {
        if (eff.duration !== undefined) eff.duration = Math.max(0.5, eff.duration * (1 - sp));
        if (eff.value !== undefined) eff.value = Math.floor(eff.value * (1 - sp));
      }"""

HOLY_NEW = """    // v3.3 P0 修复: 绝不能修改 caster.def.skill.effects。
    // def 是 ALL_CHARACTERS 里的跨对局共享对象，旧实现每次被反制都永久
    // 缩短 duration / 削弱 value，批量测试中技能效果会逐场衰减到失效。
    const effSuppress = (caster as any)._holySuppress && (sk.tags?.includes("增益") || sk.tags?.includes("控制"))
      ? (caster as any)._holySuppress : 0;
    if (effSuppress > 0) {
      const sp = effSuppress;"""

PUSH_OLD = """        t.statuses.push({
          type: effType,
          remainingSeconds: eff.duration,
          stacks: 1,
          value: val,
        });"""

PUSH_NEW = """        // v3.3 P0: 反制削弱只在施加时按局部系数计算，def 保持只读
        t.statuses.push({
          type: effType,
          remainingSeconds: eff.duration !== undefined
            ? Math.max(0.5, eff.duration * (1 - effSuppress)) : eff.duration,
          stacks: 1,
          value: val !== undefined ? Math.floor(val * (1 - effSuppress)) : val,
        });"""

WARRIOR_OLD = """  // v3.3 分档恢复: 2名每13s恢复3% / 3名每11s恢复4% / 4名每9s恢复5%
  state._warriorTimer = (state._warriorTimer || 0) + 0.1;
  for (const u of getAlive(state)) {
    if (u.def.race !== "warrior") continue;
    const wCnt = state.units.filter(
      (x: any) => x.team === u.team && !x.isDead && x.def.race === "warrior"
    ).length;
    if (wCnt < 2) continue;
    const period = wCnt >= 4 ? 9 : wCnt >= 3 ? 11 : 13; // v2.29: 9/11/13s
    if (state._warriorTimer >= period) {
      state._warriorTimer = 0;
      const pct = wCnt >= 4 ? 0.05 : wCnt >= 3 ? 0.04 : 0.03;
      const heal = Math.floor(u.maxHp * pct);
      u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      addStat(state, u.id, "totalHealingDone", heal);
      addStat(state, u.id, "skillHealing", heal);
    }
  }"""

WARRIOR_NEW = """  // v3.3 P0 修复: 按队伍分别计时（旧实现是 state 级单值且在循环内清零，
  // 敌我共享且只有第一个战士能恢复，造成镜像先手偏置）
  if (!state._warriorTimerByTeam) state._warriorTimerByTeam = { ally: 0, enemy: 0 };
  for (const team of ["ally", "enemy"] as const) {
    const teamWarriors = getAlive(state).filter(
      (u: any) => u.team === team && u.def.race === "warrior"
    );
    const wCnt = teamWarriors.length;
    if (wCnt < 2) continue;
    state._warriorTimerByTeam[team] += 0.1;
    const period = wCnt >= 4 ? 9 : wCnt >= 3 ? 11 : 13;
    if (state._warriorTimerByTeam[team] < period) continue;
    state._warriorTimerByTeam[team] = 0;
    const pct = wCnt >= 4 ? 0.05 : wCnt >= 3 ? 0.04 : 0.03;
    for (const u of teamWarriors) {
      const heal = Math.floor(u.maxHp * pct);
      u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      addStat(state, u.id, "totalHealingDone", heal);
      addStat(state, u.id, "skillHealing", heal);
    }
  }"""

CLEAR_OLD = """    // v3.3 圣裁者: DoT 结束时才清除目标全部增益
    for (const s of unit.statuses) {
      if ((s as any).remainingSeconds <= 0 && (s as any).clearBuffsOnEnd) {
        const NEG = ["stun", "sleep", "petrify", "freeze", "bind", "burn", "curse", "poison", "doom", "ruin", "silence", "disarm", "slow", "armorBreak", "sc_judge_dot"];
        unit.statuses = unit.statuses.filter((x: any) => NEG.includes(String(x.type).toLowerCase()));
      }
    }"""

CLEAR_NEW = """    // v3.3 圣裁者: DoT 结束时才清除目标全部增益（先判定再一次性 filter，
    // 避免在 for...of 遍历中重赋值 unit.statuses）
    const shouldClearBuffs = unit.statuses.some(
      (s: any) => s.remainingSeconds <= 0 && s.clearBuffsOnEnd
    );
    if (shouldClearBuffs) {
      const NEG = ["stun", "sleep", "petrify", "freeze", "bind", "burn", "curse", "poison", "doom", "ruin", "silence", "disarm", "slow", "armorBreak", "sc_judge_dot"];
      unit.statuses = unit.statuses.filter((x: any) => NEG.includes(String(x.type).toLowerCase()));
    }"""

TARGET_OLD = """        ? (sk.id === "xcl_star" ? pick2x2(enemies) : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length))"""
TARGET_NEW = """        ? (sk.id === "xcl_star" ? pick2x2(enemies)
          : sk.id === "wlgyz_heal" ? shuffle(enemies).slice(0, 1)
          : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length))"""

EDITS = [
    (HOLY_OLD, HOLY_NEW, "def 污染：反制不再写 def.effects"),
    (PUSH_OLD, PUSH_NEW, "施加时按局部系数削弱"),
    (WARRIOR_OLD, WARRIOR_NEW, "战士恢复按队伍计时"),
    (CLEAR_OLD, CLEAR_NEW, "清增益改一次性 filter"),
    (TARGET_OLD, TARGET_NEW, "亡灵歌咏者诅咒 1 名"),
]

text = BATTLE.read_text(encoding="utf-8")
changes, failures = [], []
for old, new, label in EDITS:
    if text.count(new) >= 1:
        changes.append(f"{label} (已应用)")
        continue
    n = text.count(old)
    if n != 1:
        failures.append(f"[{label}] 命中 {n} 次: {old[:70]!r}")
        continue
    text = text.replace(old, new, 1)
    changes.append(label)

print(f"成功 {len(changes)} 条 | 失败 {len(failures)} 条")
for f in failures:
    print("  ✗", f)
if failures:
    print("存在失败锚点 → 未写入")
    sys.exit(1)
if DRY:
    print("--dry-run: 未写入")
    sys.exit(0)
BATTLE.write_text(text, encoding="utf-8")
print("已写入 engine/battle.ts")
