"""v3.3 第二轮 P1：补回 V3.3 明确给出但引擎未实装的天赋/技能机制。

用法: python scripts/v33_apply_p1.py [--dry-run]
说明: V3.3 未提及的机制一律保留原样（用户要求「未提及的部分则不变」）。
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "src"
DRY = "--dry-run" in sys.argv

EDITS: list[tuple[str, str, str, str]] = [
    # ---------------- 嚎叫巨牛：激怒数值 + 每3s自损（旧实现只在触发帧扣一次） ----------------
    ("engine/battle.ts",
     """    // v3.16 嚎叫巨牛激怒: 首次HP<60% 减伤35%+攻40%+攻速30%+自损2%/2s+免疫异常
    if (unit.def.id === "hl" && !unit._hlRageTriggered && unit.currentHp / unit.maxHp < 0.6) { // v3.16f 回滚: 文档60%
      unit._hlRageTriggered = true;
      unit._hlRageAtkMult = 1.4;
      unit._hlRageSpeedMult = 1.3;
      unit._hlRageDrMult = 0.35; // v3.16f 回滚: 文档减伤35%
      unit._immuneAbnormal = true; // v3.16f 回滚: 文档免疫异常
      unit._hlRageCycle = Math.floor(state.time / 2); // v3.16 自损2%/2s 计时起点
      state.battleLog.push({ time: state.time, text: `😡 ${unit.def.name} 激怒: 攻+40% 攻速+30% 减伤35% 自损2%/2s 免疫异常`, type: "status" });
      // v3.16 巨牛激怒: 每2s自损2%最大生命
      const rageCycle2 = Math.floor(state.time / 2);
      if (unit._hlRageCycle !== rageCycle2) {
        unit._hlRageCycle = rageCycle2;
        const selfDmg2 = Math.floor(unit.maxHp * 0.02);
        unit.currentHp = Math.max(1, unit.currentHp - selfDmg2);
      }    }""",
     """    // v3.3 嚎叫巨牛激怒: 首次HP<60% → 每3s失去2%最大HP，20%减伤+30%攻+50%攻速，免疫异常至战斗结束
    if (unit.def.id === "hl" && !unit._hlRageTriggered && unit.currentHp / unit.maxHp < 0.6) {
      unit._hlRageTriggered = true;
      unit._hlRageAtkMult = 1.3;
      unit._hlRageSpeedMult = 1.5;
      unit._hlRageDrMult = 0.2;
      unit._immuneAbnormal = true;
      unit._hlRageCycle = Math.floor(state.time / 3);
      state.battleLog.push({ time: state.time, text: `😡 ${unit.def.name} 激怒: 每3s失2%HP，减伤20% 攻+30% 攻速+50% 免疫异常`, type: "status" });
    }
    // v3.3 激怒持续期间每 3s 自损 2% 最大生命（旧实现只在触发当帧扣一次）
    if (unit.def.id === "hl" && unit._hlRageTriggered) {
      const rageCycle = Math.floor(state.time / 3);
      if (unit._hlRageCycle !== rageCycle) {
        unit._hlRageCycle = rageCycle;
        const selfDmg = Math.max(1, Math.floor(unit.maxHp * 0.02));
        unit.currentHp = Math.max(1, unit.currentHp - selfDmg);
        addStat(state, unit.id, "pureDamageTaken", selfDmg);
      }
    }""",
     "hl 激怒"),

    # ---------------- 彭彭猪：催眠随机 2 选 1 ----------------
    ("engine/SkillRegistry.ts",
     """registerSkillHandler("pp_sleep", (caster, state, log) => {
  // 自身必睡 4s (v2.48: 3→4)
  caster.statuses.push({ type: StatusType.Sleep, remainingSeconds: 4, stacks: 1 });
  // 敌方后排随机一名 (后排无人则只睡自己)
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const back = enemies.filter((e: any) => e.row === Row.Back);
  if (back.length > 0) {
    const target = back[Math.floor(Math.random() * back.length)];
    target.statuses.push({ type: StatusType.Sleep, remainingSeconds: 4, stacks: 1 });
    log.push({ time: state.time, text: `💤 ${caster.def.name} 催眠 ${target.def.name}: 双方睡眠4s`, type: "status" });
  } else {
    log.push({ time: state.time, text: `💤 ${caster.def.name} 催眠: 后排无人, 只睡自己`, type: "status" });
  }
});""",
     """registerSkillHandler("pp_sleep", (caster, state, log) => {
  // v3.3 催眠: 随机发动 1 个效果
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (Math.random() < 0.5) {
    // ① 自身与随机一名敌人同时睡眠 4s（优先后排）
    caster.statuses.push({ type: StatusType.Sleep, remainingSeconds: 4, stacks: 1 });
    const back = enemies.filter((e: any) => e.row === Row.Back);
    const pool = back.length > 0 ? back : enemies;
    if (pool.length > 0) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      target.statuses.push({ type: StatusType.Sleep, remainingSeconds: 4, stacks: 1 });
      log.push({ time: state.time, text: `💤 ${caster.def.name} 催眠① ${target.def.name}: 双方睡眠4s`, type: "status" });
    } else {
      log.push({ time: state.time, text: `💤 ${caster.def.name} 催眠①: 无敌人，只睡自己4s`, type: "status" });
    }
  } else {
    // ② 自身睡眠 5s，随机 2 名敌人困意 6s（命中率 -75%）
    caster.statuses.push({ type: StatusType.Sleep, remainingSeconds: 5, stacks: 1 });
    const picked = (shuffle(enemies) as any[]).slice(0, 2);
    for (const t of picked) {
      t._drowsyUntil = state.time + 6;
      t.hitRateMod = (t.hitRateMod || 0) - 0.75;
      t._drowsyApplied = 0.75;
    }
    log.push({ time: state.time, text: `💤 ${caster.def.name} 催眠② 自身睡5s，${picked.length}名敌人困意6s(命中率-75%)`, type: "status" });
  }
});""",
     "pp 催眠2选1"),

    # ---------------- 困意到期恢复 + 魂之引渡者施加负面叠层 ----------------
    ("engine/battle.ts",
     "    // 兼容旧字段（若历史存档仍带 _mageAtkExpire）",
     """    // v3.3 彭彭猪「困意」到期恢复命中率
    if ((unit as any)._drowsyUntil && state.time >= (unit as any)._drowsyUntil) {
      unit.hitRateMod = (unit.hitRateMod || 0) + ((unit as any)._drowsyApplied || 0.75);
      (unit as any)._drowsyUntil = undefined;
      (unit as any)._drowsyApplied = undefined;
    }
    // v3.3 魂之引渡者: 每当我方对敌施加负面状态（每次施加动作仅 +1 层）
    const NEG_STATUS = ["stun", "sleep", "petrify", "freeze", "bind", "burn", "curse", "poison", "doom", "ruin", "silence", "disarm", "slow", "armorBreak"];
    const negNow = unit.statuses.filter((s: any) => NEG_STATUS.includes(String(s.type).toLowerCase())).length;
    if (negNow > ((unit as any)._negCountPrev || 0)) {
      for (const hyz of state.units.filter(
        (x: any) => x.team === unit.team && !x.isDead && x.def.id === "hyz" && !isRuined(x)
      )) {
        (hyz as any)._hyzStacks = Math.min(5, ((hyz as any)._hyzStacks || 0) + 1);
      }
    }
    (unit as any)._negCountPrev = negNow;
    // 兼容旧字段（若历史存档仍带 _mageAtkExpire）""",
     "pp困意/hyz叠层"),

    # ---------------- 魂之引渡者：复活后立即 5 层 ----------------
    ("engine/battle.ts",
     """        u.hasRevived = true;
        // v3.3: 延迟后每秒失去最大HP×X%（字段实现，无法驱散）""",
     """        u.hasRevived = true;
        // v3.3 魂之引渡者: 复活后立即获得 5 层魂能
        if (u.def.id === "hyz") (u as any)._hyzStacks = 5;
        // v3.3: 延迟后每秒失去最大HP×X%（字段实现，无法驱散）""",
     "hyz 复活5层"),

    # ---------------- 末日使者：对异常状态目标 +10% 伤害 ----------------
    ("engine/damage.ts",
     "    // v3.0 追风游侠: 切入技能伤害-35%",
     """    // v3.3 末日使者: 攻击处于异常状态的敌人造成伤害 +10%
    if (attacker.def.id === "mrsz" && defender.statuses.length > 0) {
      effectiveAtk *= attacker.hasRevived ? 1.2 : 1.1;
    }
    // v3.0 追风游侠: 切入技能伤害-35%""",
     "mrsz 异常目标增伤"),

    # ---------------- 圣骑士：免疫扩展到缴械/诅咒 ----------------
    ("engine/battle.ts",
     '        // P1修复: 圣骑士免疫沉默/破坏\n        if ((eff.type === StatusType.Silence || eff.type === StatusType.Ruin) && t.def.id === "sq") continue;',
     """        // v3.3 圣骑士: 免疫 [沉默]/[破坏]/[缴械]/[诅咒]
        if ([StatusType.Silence, StatusType.Ruin, StatusType.Disarm, StatusType.Curse].includes(eff.type) && t.def.id === "sq") continue;""",
     "sq 免疫扩展"),

    # ---------------- 星辰龙：20% 概率（不再 100% 施加） ----------------
    ("data/characters.ts",
     """    effects: [
      { type: StatusType.Silence, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
    ],""",
     """    effects: [
      { type: StatusType.Silence, duration: 3, chance: 0.2 },
      { type: StatusType.Disarm, duration: 3, chance: 0.2 },
    ],""",
     "xcl 20%概率"),

    # ---------------- 圣职者羁绊：#控制 反制（3人5% / 4人10%） ----------------
    ("engine/battle.ts",
     "    // v2.10 增益类效果(血怒/激昂等)施加给自己而非敌人",
     """    // v3.3 圣职者羁绊: #控制 → 使敌方随机 1 名角色受到 5%/10% 持续时间的效果与伤害的同技能
    if ((caster as any)._holySuppress && sk.tags?.includes("控制")) {
      const lv = (caster as any)._holyMirror;
      const pct = lv === 3 ? 0.1 : lv === 2 ? 0.05 : 0;
      if (pct > 0) {
        const pool = state.units.filter((x: any) => x.team === caster.team && !x.isDead);
        const victim = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;
        if (victim) {
          const ratio = (sk.damage?.[0]?.atkRatio ?? 1) * pct;
          const r = calcDamage(caster, victim, ratio, DamageType.Pure, { isSkill: true });
          victim.currentHp -= r.finalDamage;
          for (const eff of sk.effects ?? []) {
            victim.statuses.push({
              type: eff.type,
              remainingSeconds: Math.max(0.5, (eff.duration ?? 1) * pct),
              stacks: 1,
              value: eff.value,
            });
          }
          log.push({ time: state.time, text: `🕊 圣职者羁绊(控制反制): ${victim.def.name} 受到 ${Math.round(pct * 100)}% 同技能`, type: "status" });
        }
      }
    }
    // v2.10 增益类效果(血怒/激昂等)施加给自己而非敌人""",
     "holy 控制反制"),
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
