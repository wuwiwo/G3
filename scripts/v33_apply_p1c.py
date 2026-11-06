"""v3.3 第二轮 P1c：目标选择类机制补齐（祈祷者天赋、幽暗密行者、星辰龙 2×2）。

用法: python scripts/v33_apply_p1c.py [--dry-run]
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "src"
DRY = "--dry-run" in sys.argv

QD_OLD = """    // v3.0 祈祷者天赋: 我方施法成功 → 敌方随机1名 8%纯粹
    {
      const qd = state.units.find(
        (u: any) => u.team === caster.team && !u.isDead && u.def.id === "qd" && !isRuined(u)
      );
      if (qd && sk.castTime > 0) {
        const qEnemies = getEnemies(state, qd.team).filter((e: any) => !e.isDead);
        if (qEnemies.length > 0) {
          const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
          const qr = calcDamage(qd, qt, 0.08, DamageType.Pure, { isSkill: true });
          qt.currentHp -= qr.finalDamage;
          addStat(state, qd.id, "totalDamageDealt", qr.finalDamage);
        }
      }
    }
    return;"""

QD_NEW = """    return;"""

QD_INSERT_ANCHOR = "  caster.lastSkillCast = { name: sk.name, time: state.time };"
QD_INSERT = QD_INSERT_ANCHOR + """
  // v3.3 祈祷者天赋: 我方所有角色每次技能后（不限施法/标签），3%纯粹 + 3%治疗
  {
    const qd = state.units.find(
      (u: any) => u.team === caster.team && !u.isDead && u.def.id === "qd" && !isRuined(u)
    );
    if (qd) {
      const qEnemies = getEnemies(state, qd.team).filter((e: any) => !e.isDead);
      const mates = state.units.filter((u: any) => u.team === qd.team && !u.isDead);
      if (qEnemies.length > 0 && mates.length > 0) {
        const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
        const qr = calcDamage(qd, qt, 0.03, DamageType.Pure, { isSkill: true });
        qt.currentHp -= qr.finalDamage;
        addStat(state, qd.id, "totalDamageDealt", qr.finalDamage);
        const ht = mates[Math.floor(Math.random() * mates.length)];
        const h = Math.floor(qd.currentAttack * 0.03);
        ht.currentHp = Math.min(ht.maxHp, ht.currentHp + h);
        addStat(state, qd.id, "totalHealingDone", h);
      }
    }
  }"""

YAM_OLD = """  // 对称2名敌方: 自己+友方各对称1名 → 沉默4s + 135%纯伤
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const hit = [];
  for (const me of [caster, buddy]) {
    const sym = enemies.find((e: any) => e.row === me.row && e.col === me.col);
    if (sym) hit.push(sym);
  }"""
YAM_NEW = """  // v3.3: 随机 2 名敌人（原为对称 2 名）→ 沉默4s + 120%纯伤
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const hit = (shuffle(enemies) as any[]).slice(0, 2);"""

PICK2X2 = """/** v3.3 星辰龙: 随机 2×2 格子上的敌人 */
function pick2x2(enemies: any[]): any[] {
  const r = Math.random() < 0.5 ? 0 : 1;
  const c = Math.random() < 0.5 ? 0 : 1;
  return enemies.filter(
    (e: any) => e.row >= r && e.row <= r + 1 && e.col >= c && e.col <= c + 1
  );
}

"""

EDITS: list[tuple[str, str, str, str]] = [
    ("engine/battle.ts", QD_OLD, QD_NEW, "qd 移除旧触发"),
    ("engine/battle.ts", QD_INSERT_ANCHOR, QD_INSERT, "qd 通用天赋"),
    ("engine/SkillRegistry.ts", YAM_OLD, YAM_NEW, "yammxz 随机2名"),
    ("engine/battle.ts", "function pickTarget(", PICK2X2 + "function pickTarget(", "pick2x2 辅助函数"),
    ("engine/battle.ts",
     """    const scriptTargets = sk.aoe
      ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)""",
     """    const scriptTargets = sk.aoe
      ? (sk.id === "xcl_star" ? pick2x2(enemies) : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length))""",
     "xcl 2x2 伤害目标"),
    ("engine/battle.ts",
     """    const targets = isSelfBuff
      ? [caster]
      : sk.aoe
        ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)""",
     """    const targets = isSelfBuff
      ? [caster]
      : sk.aoe
        ? (sk.id === "xcl_star" ? pick2x2(enemies) : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length))""",
     "xcl 2x2 效果目标"),
]

changes, failures = [], []
contents = {rel: (SRC / rel).read_text(encoding="utf-8") for rel in {e[0] for e in EDITS}}

for rel, old, new, label in EDITS:
    cur = contents[rel]
    if cur.count(new) >= 1 and old != QD_INSERT_ANCHOR:
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
