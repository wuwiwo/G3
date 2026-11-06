"""v3.3 第二轮：P0 引擎机制缺陷修复 + handler 硬编码统一读数据层。

用法: python scripts/v33_apply_p0.py [--dry-run]
纪律: SKILL.md 第四节（锚点精确、原子性、描述与数值同步）
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "src"
DRY = "--dry-run" in sys.argv

EDITS: list[tuple[str, str, str, str]] = [
    # ---------------- 数据层：冥火双重结算 ----------------
    ("data/characters.ts",
     """    damage: [
      { type: DamageType.Magical, atkRatio: 1.5 },
      { type: DamageType.Pure, atkRatio: 0.75 },
    ],""",
     """    // v3.3: 75%纯粹由 battle.ts 的 4s 延迟结算，此处不再重复立即结算
    damage: [{ type: DamageType.Magical, atkRatio: 1.5 }],""",
     "kldd 冥火双重结算"),

    # ---------------- SkillRegistry：火焰翼龙 ----------------
    ("engine/SkillRegistry.ts",
     """    remainingSeconds: 6,
    stacks: 1,
    value: Math.floor(caster.currentAttack * 1.35),""",
     """    remainingSeconds: 7,
    stacks: 1,
    value: Math.floor(caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35)),""",
     "hlyl DoT 每跳/时长"),
    ("engine/SkillRegistry.ts",
     '(state as any).trackTalent(state, caster.id, "火焰喷吐(DoT)", Math.floor(caster.currentAttack * 0.5 * 6), "damage");',
     '(state as any).trackTalent(state, caster.id, "火焰喷吐(DoT)", Math.floor(caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35) * 7), "damage");',
     "hlyl 埋点"),
    ("engine/SkillRegistry.ts",
     "text: `🔥 ${caster.def.name} 喷吐 ${target.def.name}: 每秒50%魔法×6s`",
     "text: `🔥 ${caster.def.name} 喷吐 ${target.def.name}: 每秒35%魔法×7s`",
     "hlyl 日志"),

    # ---------------- SkillRegistry：血翼飞龙 ----------------
    ("engine/SkillRegistry.ts",
     """  const rows = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2);
  const targets = enemies.filter((e: any) => rows.includes(e.row));
  const hitCount = targets.length;""",
     """  // v3.3: 随机 4 名敌人（不再是随机 2 排）
  const targets = (shuffle(enemies) as any[]).slice(0, 4);
  const hitCount = targets.length;""",
     "xyfl 目标选择"),
    ("engine/SkillRegistry.ts",
     """    let ratio = 2.6; // v3.15g: 血翼260%
    if (hitCount >= 5) ratio *= 0.7; // 命中5-6人-30%""",
     """    // v3.3: 240%物理，倍率从数据层读取；不再有「命中5人-30%」
    const ratio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.4;""",
     "xyfl 倍率"),
    ("engine/SkillRegistry.ts",
     """  // 60%几率打乱位置 (目标与同队随机单位交换位置)
  for (const t of targets) {
    if (Math.random() < 0.6) {
      const mates = state.units.filter(
        (u: any) => u.team === t.team && !u.isDead && u.id !== t.id
      );
      if (mates.length > 0) {
        const mate = mates[Math.floor(Math.random() * mates.length)];
        const r0 = t.row, c0 = t.col;
        t.row = mate.row;
        t.col = mate.col;
        mate.row = r0;
        mate.col = c0;
      }
    }
  }""",
     """  // v3.3: 必定在这 4 名目标之间随机打乱位置
  const cells = targets.map((t: any) => ({ row: t.row, col: t.col }));
  const shuffledCells = shuffle(cells);
  targets.forEach((t: any, i: number) => {
    t.row = shuffledCells[i].row;
    t.col = shuffledCells[i].col;
  });""",
     "xyfl 打乱位置"),

    # ---------------- SkillRegistry：暴君龙 ----------------
    ("engine/SkillRegistry.ts",
     """  const midBack = enemies
    .filter((e: any) => e.row === Row.Mid || e.row === Row.Back)
    .sort((a: any, b: any) => b.row - a.row);
  if (midBack.length === 0) return;
  const targets = midBack.slice(0, 2);
  const dmgRatios = [2.3, 2.8]; // v3.15f: 230/280""",
     """  // v3.3: 中排、后排各 1 名
  const mid = shuffle(enemies.filter((e: any) => e.row === Row.Mid)) as any[];
  const back = shuffle(enemies.filter((e: any) => e.row === Row.Back)) as any[];
  const picked: any[] = [mid[0], back[0]].filter(Boolean);
  if (picked.length < 2)
    picked.push(...(shuffle(enemies.filter((e: any) => !picked.includes(e))) as any[]).slice(0, 2 - picked.length));
  const targets = picked.slice(0, 2);
  const dmgRatios = [
    caster.def.skill.damage?.[0]?.atkRatio ?? 2.0,
    caster.def.skill.damage?.[1]?.atkRatio ?? 2.4,
  ];""",
     "bjl 目标/倍率"),

    # ---------------- SkillRegistry：地龙 ----------------
    ("engine/SkillRegistry.ts",
     "const rowMultipliers: Record<number, number> = { 0: 1.4, 1: 1.1, 2: 0.8 };",
     "const rowMultipliers: Record<number, number> = { 0: 1.3, 1: 1.0, 2: 0.7 }; // v3.3 130/100/70%",
     "dl 行系数"),

    # ---------------- SkillRegistry：冰霜邪龙 ----------------
    ("engine/SkillRegistry.ts",
     """  const enemies = state.units
    .filter((u: any) => u.team !== caster.team && !u.isDead)
    .filter((u: any) => u.row === 2);
  if (enemies.length === 0) return;
  caster._bsxlFreezeCount = (caster._bsxlFreezeCount || 0) + 1;
  const isFreeze = caster._bsxlFreezeCount >= 3;""",
     """  // v3.3: 随机 1 排敌人
  const aliveEnemies = state.units.filter((u: any) => u.team !== caster.team && !u.isDead);
  const rows = [...new Set(aliveEnemies.map((u: any) => u.row))];
  if (rows.length === 0) return;
  const row = rows[Math.floor(Math.random() * rows.length)];
  const enemies = aliveEnemies.filter((u: any) => u.row === row);
  caster._bsxlFreezeCount = (caster._bsxlFreezeCount || 0) + 1;
  const isFreeze = caster._bsxlFreezeCount >= 2; // v3.3 每 2 次""",
     "bsxl 随机排/升级次数"),
    ("engine/SkillRegistry.ts",
     """        remainingSeconds: 3,
        stacks: 1,
        value: Math.floor(caster.currentAttack * 1.4),""",
     """        remainingSeconds: 4,
        stacks: 1,
        value: Math.floor(caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.6)),""",
     "bsxl DoT 每跳/时长"),
    ("engine/SkillRegistry.ts",
     "t._slowUntil = Math.max(t._slowUntil || 0, state.time + 3);",
     "t._slowUntil = Math.max(t._slowUntil || 0, state.time + 4); // v3.3 降攻速4s",
     "bsxl 降攻速时长"),

    # ---------------- SkillRegistry：圣骑士 ----------------
    ("engine/SkillRegistry.ts",
     "t._sqShieldUntil = state.time + 8;",
     "t._sqShieldUntil = state.time + 7; // v3.3 护盾7s",
     "sq 护盾时长"),
    ("engine/SkillRegistry.ts",
     "text: `🛡 ${caster.def.name} 圣光治愈 ${pfx(t)}: +${heal}${hasNeg ? \" (驱散+30%)\" : \"\"}`, type: \"heal\"",
     "text: `🛡 ${caster.def.name} 圣光治愈 ${pfx(t)}: +${heal}${hasNeg ? \" (驱散+30%)\" : \"\"} +圣之护盾7s`, type: \"heal\"",
     "sq 日志"),

    # ---------------- SkillRegistry：圣裁者 ----------------
    ("engine/SkillRegistry.ts",
     "const hasBuff = (top.statuses || []).length > 0;",
     """// v3.3: 只把「增益状态」算作有增益，负面/DoT 不算
  const NEGATIVE = ["stun", "sleep", "petrify", "freeze", "bind", "burn", "curse", "poison", "doom", "ruin", "silence", "disarm", "slow", "armorBreak", "sc_judge_dot"];
  const hasBuff = (top.statuses || []).some((s: any) => !NEGATIVE.includes(String(s.type).toLowerCase()));""",
     "sc 增益判定"),
    ("engine/SkillRegistry.ts",
     "top.statuses.push({ type: \"sc_judge_dot\" as any, remainingSeconds: 4, stacks: 1, value: Math.floor(atk * 0.35), sourceId: caster.id }); // v3.3 35%×4s // v3.15: +sourceId（统计用）\n  if (hasBuff) top.statuses = [];",
     """top.statuses.push({ type: "sc_judge_dot" as any, remainingSeconds: 4, stacks: 1, value: Math.floor(atk * 0.35), sourceId: caster.id, clearBuffsOnEnd: hasBuff });
  // v3.3: 效果「结束后」清除目标全部增益，不再立即清空（旧实现会自删沉默与 DoT）""",
     "sc 结束清增益"),
    ("engine/SkillRegistry.ts",
     "text: `⚖ ${caster.def.name} 审判之光 ${pfx(top)}: 沉默+30%纯粹×5s${hasBuff ? \" (增益清除)\" : \"\"}`",
     "text: `⚖ ${caster.def.name} 审判之光 ${pfx(top)}: 沉默+35%纯粹×4s${hasBuff ? \" (结束清增益)\" : \"\"}`",
     "sc 日志"),

    # ---------------- damage.ts：圣之护盾 ----------------
    ("engine/damage.ts",
     "if (defender._sqShieldUntil && defender._sqShieldUntil > ((extraOpts as any)?.now ?? 0) && (type as any) === DamageType.Magical && (defender as any)._sqShieldPhys) {",
     "if (defender._sqShieldUntil && defender._sqShieldUntil > ((extraOpts as any)?.now ?? 0) && (type as any) === DamageType.Magical) { // v3.3 修死代码",
     "sq 护盾减伤"),
    ("engine/damage.ts",
     """  // Fatal strike handled externally by applyFatalStrike()

  return result;""",
     """  // Fatal strike handled externally by applyFatalStrike()

  // v3.3 圣之护盾: 反弹 10% 原本伤害（减免前 rawDamage）至发动者，纯粹伤害
  if (defender._sqShieldUntil && defender._sqShieldUntil > ((extraOpts as any)?.now ?? 0)
      && result.finalDamage > 0 && attacker !== defender && !attacker.isDead) {
    const reflect = Math.max(1, Math.floor(result.rawDamage * 0.1));
    attacker.currentHp -= reflect;
    (attacker as any).lastDamage = { value: reflect, time: (extraOpts as any)?.now ?? 0, type: "pure" };
  }

  return result;""",
     "sq 护盾反伤"),

    # ---------------- battle.ts：近9s统计 / 冥火 / DoT结束清增益 ----------------
    ("engine/battle.ts",
     """function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}""",
     """function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
  // v3.3 圣裁者「最近 9s 累计伤害」滚动窗口（此前 _dmgRecent9s 从未赋值）
  if (field === "totalDamageDealt" && value > 0) {
    const u = state.units?.find((x: any) => x.id === unitId);
    if (u) {
      if (!u._dmgWindow) u._dmgWindow = [];
      u._dmgWindow.push({ t: state.time, v: value });
      const cutoff = state.time - 9;
      u._dmgWindow = u._dmgWindow.filter((e: any) => e.t >= cutoff);
      u._dmgRecent9s = u._dmgWindow.reduce((sum: number, e: any) => sum + e.v, 0);
    }
  }
}""",
     "sc 近9s统计"),
    ("engine/battle.ts",
     "t._hammerDelayedDmg = Math.floor(caster.currentAttack * 1.0);",
     """t._hammerDelayedDmg = Math.floor(caster.currentAttack * 0.75); // v3.3 75%纯粹
          // v3.3 骷髅大帝自身恢复 25% 攻击的血量
          const selfHeal = Math.floor(caster.currentAttack * 0.25);
          caster.currentHp = Math.min(caster.maxHp, caster.currentHp + selfHeal);
          addStat(state, caster.id, "totalHealingDone", selfHeal);""",
     "kldd 延迟倍率+自愈"),
    ("engine/battle.ts",
     "text: `🔨 ${unit.def.name} 冥火延迟伤害: ${hd}`",
     "text: `🔨 ${unit.def.name} 冥火延迟伤害(75%纯粹): ${hd}`",
     "kldd 延迟日志"),
    ("engine/battle.ts",
     "    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);",
     """    // v3.3 圣裁者: DoT 结束时才清除目标全部增益
    for (const s of unit.statuses) {
      if ((s as any).remainingSeconds <= 0 && (s as any).clearBuffsOnEnd) {
        const NEG = ["stun", "sleep", "petrify", "freeze", "bind", "burn", "curse", "poison", "doom", "ruin", "silence", "disarm", "slow", "armorBreak", "sc_judge_dot"];
        unit.statuses = unit.statuses.filter((x: any) => NEG.includes(String(x.type).toLowerCase()));
      }
    }
    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);""",
     "sc DoT结束清增益"),
]

changes, failures = [], []
contents = {rel: (SRC / rel).read_text(encoding="utf-8") for rel in {e[0] for e in EDITS}}

for rel, old, new, label in EDITS:
    cur = contents[rel]
    if cur.count(new) >= 1:
        changes.append(f"{label} (已应用)")
        continue
    n = cur.count(old)
    if n != 1:
        failures.append(f"[{label}] {rel} 命中 {n} 次: {old[:80]!r}")
        continue
    contents[rel] = cur.replace(old, new, 1)
    changes.append(label)

print(f"成功 {len(changes)} 条 | 失败 {len(failures)} 条")
for f in failures:
    print("  ✗", f)
if failures:
    print("存在失败锚点 → 未写入（原子性保护）")
    sys.exit(1)
if DRY:
    print("--dry-run: 未写入")
    sys.exit(0)
for rel, txt in contents.items():
    (SRC / rel).write_text(txt, encoding="utf-8")
print("已写入:", ", ".join(contents))
