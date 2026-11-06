"""v3.3 第二轮 P1b：每秒治疗 DoT、殉道者新技能、阵亡后继续施法。

用法: python scripts/v33_apply_p1b.py [--dry-run]
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "src"
DRY = "--dry-run" in sys.argv

LYZ_OLD = """registerSkillHandler("lyz_heal", (caster, state, log, targets) => {
  if (!caster.def.skill.heal) return;
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  const deadDragons = state.units.filter(
    (u: any) => u.team === caster.team && u.isDead && u.def.race === "dragon"
  );

  // Track cast count
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount >= 4;

  // Target selection: lowest HP dragon(s)
  let targetsList = allies
    .filter((u: any) => u.def.race === "dragon")
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);

  if (targetsList.length === 0) return;

  const selected = upgraded ? targetsList.slice(0, 2) : [targetsList[0]];
  const ratio = upgraded ? 0.7 : 0.4; // P0修复: 按文档 40%/70%
  const dr = upgraded ? 0.3 : 0.2; // P0修复: 按文档 20%/30% // v2.38: 0.12/0.06 → 0.1/0.05

  for (const t of selected) {
    const healAmt = Math.floor(caster.currentAttack * ratio);
    caster.lastHealTarget = t.id; // v3.15: 治疗统计
    t.lastHeal = { value: healAmt, time: state.time };
    addStat(state, caster.id, "totalHealingDone", healAmt);
    addStat(state, caster.id, "totalHealing", healAmt);
    addStat(state, t.id, "totalHealingReceived", healAmt);
    t.currentHp = Math.min(t.maxHp, t.currentHp + healAmt);
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: +${healAmt}${upgraded ? "(强化)" : ""}`,
      type: "heal",
    });
  }

  // Temporary revive a dead dragon if any ally dragon died this battle
  if (deadDragons.length > 0) {
    const reviveTarget =
      deadDragons[Math.floor(Math.random() * deadDragons.length)];
    reviveTarget.isDead = false;
    reviveTarget.currentHp = Math.floor(reviveTarget.maxHp * 0.5);
    reviveTarget.statuses = [];
    reviveTarget.tempReviveTimer = 2; // v2.32d 削: 3→2s
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 临时复活 ${reviveTarget.def.name} 5s!`,
      type: "status",
    });
  }
});"""

LYZ_NEW = """registerSkillHandler("lyz_heal", (caster, state, log) => {
  // v3.3: 治疗最低 HP 的 1 名龙族，每秒攻击×40% 并 20%减伤 4s
  const dragons = state.units
    .filter((u: any) => u.team === caster.team && !u.isDead && u.def.race === "dragon")
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  if (dragons.length === 0) return;
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount % 5 === 0; // v3.3 每 4 次后，下次发动升级
  const t = dragons[0];
  t.statuses.push({
    type: "lyz_heal_dot" as any,
    remainingSeconds: 4,
    stacks: 1,
    value: Math.floor(caster.currentAttack * 0.4),
    sourceId: caster.id,
  } as any);
  t._lyzDrUntil = state.time + 4;
  t._lyzDr = 0.2;
  log.push({
    time: state.time,
    text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: 每秒攻击×40% + 减伤20% ×4s`,
    type: "heal",
  });
  // v3.3 升级: 若存在阵亡龙族，随机复活 1 只并无敌 5s，结束后重新阵亡
  if (upgraded) {
    const dead = state.units.filter(
      (u: any) => u.team === caster.team && u.isDead && u.def.race === "dragon" && !u.tempReviveTimer
    );
    if (dead.length > 0) {
      const r = dead[Math.floor(Math.random() * dead.length)];
      r.isDead = false;
      r.currentHp = Math.max(1, Math.floor(r.maxHp * 0.5));
      r.statuses = [];
      r.tempReviveTimer = 5;
      r.invincibleTimer = 5;
      log.push({ time: state.time, text: `🎵 ${caster.def.name} 升级复活 ${r.def.name} 无敌5s`, type: "status" });
    }
  }
});"""

XD_HANDLER_OLD = """registerSkillHandler("xd_sacrifice", (caster, state, log) => {
  const cost = Math.floor(caster.currentHp * 0.25);
  caster.currentHp -= cost;
  const enemies = state.units.filter((u: any) => u.team !== caster.team && !u.isDead && u.row !== Row.Back);
  const targets = shuffle(enemies).slice(0, 2) as any[];
  for (const t of targets as any[]) {
    t._xdTauntUntil = state.time + 6;
    t._xdTauntId = caster.id;
  }
  log.push({ time: state.time, text: `✝ ${caster.def.name} 牺牲: 嘲讽${targets.length}名敌人6s`, type: "control" });
});"""

XD_HANDLER_NEW = """registerSkillHandler("xd_sacrifice", (caster, state, log) => {
  // v3.3: 使敌方随机 1 名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续5s
  const enemies = state.units.filter((u: any) => u.team !== caster.team && !u.isDead);
  if (enemies.length === 0) return;
  const t = enemies[Math.floor(Math.random() * enemies.length)];
  t._xdDmgDownUntil = state.time + 5;
  t._xdDmgDown = 0.2;
  const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
  t.statuses.push({
    type: "xd_dot" as any, remainingSeconds: 5, stacks: 1,
    value: Math.max(1, Math.floor(defSum * 0.2)), sourceId: caster.id,
  } as any);
  log.push({ time: state.time, text: `✝ ${caster.def.name} 牺牲: ${t.def.name} 造成伤害-20% + 每秒${Math.floor(defSum * 0.2)}纯粹×5s`, type: "control" });
});"""

XD_TALENT_OLD = """    // v3.0 殉道者阵亡: 敌方全体120%纯粹 + 我方回30%最大HP + 祝福30s
    if (u.def.id === "xd") {
      for (const e of state.units.filter((x: any) => x.team !== u.team && !x.isDead)) {
        const dr = Math.floor(u.currentAttack * 0.9); // v3.3 90%纯粹
        e.currentHp -= dr;
        addStat(state, u.id, "totalDamageDealt", dr);
      }
      for (const a of state.units.filter((x: any) => x.team === u.team && !x.isDead)) {
        a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * 0.08)); // v3.3 恢复8%
        a._xdBlessUntil = state.time + 30;
        a._xdBlessDmg = 1.1;
        a._xdBlessDr = 0.9;
      }
      state.battleLog.push({ time: state.time, text: `✝ ${u.def.name} 殉道: 敌方全体150%纯粹, 我方回30%+祝福`, type: "heal" });
    }"""

XD_TALENT_NEW = """    // v3.3 殉道者: 每当友方角色阵亡（不再只在自身阵亡时）
    const martyr = state.units.find((x: any) => x.team === u.team && x.def.id === "xd");
    if (martyr) {
      for (const e of state.units.filter((x: any) => x.team !== u.team && !x.isDead)) {
        const dr = Math.floor(martyr.currentAttack * 0.9);
        e.currentHp -= dr;
        addStat(state, martyr.id, "totalDamageDealt", dr);
        addStat(state, martyr.id, "pureDamage", dr);
      }
      for (const a of state.units.filter((x: any) => x.team === u.team && !x.isDead)) {
        a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * 0.08));
        addStat(state, martyr.id, "totalHealingDone", Math.floor(a.maxHp * 0.08));
      }
      state.battleLog.push({ time: state.time, text: `✝ ${u.def.name} 阵亡触发殉道: 敌方全体攻击×90%纯粹, 我方剩余回8%最大HP`, type: "heal" });
    }"""

DOT_BLOCK = """      // v3.3 龙吟者 / 寒冰飞龙: 每秒治疗 DoT
      if (((s.type as string) === "lyz_heal_dot" || (s.type as string) === "hbfl_heal_dot") && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const heal = s.value;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
          addStat(state, unit.id, "totalHealingReceived", heal);
          const src = state.units.find((x: any) => x.id === (s as any).sourceId);
          if (src) {
            addStat(state, src.id, "totalHealingDone", heal);
            addStat(state, src.id, "totalHealing", heal);
          }
          state.battleLog.push({ time: state.time, text: `💚 ${unit.def.name} 每秒治疗 +${heal}`, type: "heal" });
        }
      }
      // v3.3 殉道者: 每秒目标自身防御总和×20% 纯粹
      if ((s.type as string) === "xd_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find((x: any) => x.id === (s as any).sourceId);
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "pureDamage", dmg);
          }
          state.battleLog.push({ time: state.time, text: `✝ ${unit.def.name} 殉道纯粹 ${dmg}`, type: "damage" });
        }
      }
      // v2.12 冰霜猎人持续射击 DoT: 每秒90%物理"""

POSTMORTEM = """
/** v3.3 殉道者: 自身阵亡后该技能依然能继续发动，但冷却时间延长 50% */
function updateMartyrPostmortem(state: any) {
  for (const xd of state.units.filter((u: any) => u.def.id === "xd" && u.isDead)) {
    if (xd._xdPostmortemCd === undefined) xd._xdPostmortemCd = 0;
    xd._xdPostmortemCd -= 0.1;
    if (xd._xdPostmortemCd > 0) continue;
    xd._xdPostmortemCd = (xd.def.skill.cooldown || 8) * 1.5;
    const enemies = state.units.filter((u: any) => u.team !== xd.team && !u.isDead);
    if (enemies.length === 0) continue;
    const t = enemies[Math.floor(Math.random() * enemies.length)];
    t._xdDmgDownUntil = state.time + 5;
    t._xdDmgDown = 0.2;
    const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
    t.statuses.push({
      type: "xd_dot" as any, remainingSeconds: 5, stacks: 1,
      value: Math.max(1, Math.floor(defSum * 0.2)), sourceId: xd.id,
    } as any);
    state.battleLog.push({ time: state.time, text: `✝ ${xd.def.name} 阵亡后继续发动【牺牲】→ ${t.def.name}`, type: "control" });
  }
}
"""

EDITS: list[tuple[str, str, str, str]] = [
    ("engine/SkillRegistry.ts", LYZ_OLD, LYZ_NEW, "lyz 每秒治疗+升级复活无敌"),
    ("engine/SkillRegistry.ts", XD_HANDLER_OLD, XD_HANDLER_NEW, "xd 新技能"),
    ("engine/battle.ts", XD_TALENT_OLD, XD_TALENT_NEW, "xd 天赋改友方阵亡"),
    ("engine/battle.ts", "      // v2.12 冰霜猎人持续射击 DoT: 每秒90%物理", DOT_BLOCK, "治疗/殉道DoT结算"),
    ("engine/battle.ts",
     """      if (sk.id === "hbfl_heal") {
        t.statuses.push({ type: StatusType.Freeze, remainingSeconds: 4, stacks: 1 });
        state.battleLog.push({ time: state.time, text: `🧊 ${t.def.name} 冰封4s (免疫物理)`, type: "status" });
      }""",
     """      if (sk.id === "hbfl_heal") {
        t.statuses.push({ type: StatusType.Freeze, remainingSeconds: 4, stacks: 1 });
        // v3.3: 每秒 攻击×70% + 最大HP×3%，持续 4s（修「一次性当 DoT」）
        t.statuses.push({
          type: "hbfl_heal_dot" as any, remainingSeconds: 4, stacks: 1,
          value: Math.floor(caster.currentAttack * 0.7 + t.maxHp * 0.03), sourceId: caster.id,
        } as any);
        state.battleLog.push({ time: state.time, text: `🧊 ${t.def.name} 冰封4s，每秒治疗×4s`, type: "status" });
        continue;
      }""",
     "hbfl 每秒治疗"),
    ("engine/battle.ts",
     "  updateDeaths(state);\n  updateRevivals(state);",
     "  updateDeaths(state);\n  updateMartyrPostmortem(state); // v3.3 殉道者阵亡后继续施法\n  updateRevivals(state);",
     "processTick 挂载"),
    ("engine/battle.ts", "function updateVictory(state: any) {", POSTMORTEM + "\nfunction updateVictory(state: any) {", "殉道者阵亡后续函数"),
    ("engine/damage.ts",
     "    let holyDr = 1;\n    if (defender._qdDrUntil",
     """    let holyDr = 1;
    // v3.3 龙吟者: 20% 减伤 4s
    if ((defender as any)._lyzDrUntil && (defender as any)._lyzDrUntil > ((extraOpts as any)?.now ?? 0)) {
      holyDr *= 1 - ((defender as any)._lyzDr || 0.2);
    }
    if (defender._qdDrUntil""",
     "lyz 减伤应用"),
    ("engine/damage.ts",
     "    // v3.3 末日使者: 攻击处于异常状态的敌人造成伤害 +10%",
     """    // v3.3 殉道者: 目标造成伤害-20% 持续5s
    if ((attacker as any)._xdDmgDownUntil && (attacker as any)._xdDmgDownUntil > ((extraOpts as any)?.now ?? 0)) {
      effectiveAtk *= 1 - ((attacker as any)._xdDmgDown || 0.2);
    }
    // v3.3 末日使者: 攻击处于异常状态的敌人造成伤害 +10%""",
     "xd 降伤应用"),
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
        failures.append(f"[{label}] {rel} 命中 {n} 次: {old[:70]!r}")
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
