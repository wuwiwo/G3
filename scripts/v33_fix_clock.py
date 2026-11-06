"""v3.3 关键实现缺陷修复：让 damage.ts 的时间判断真正生效。

问题: battle.ts / SkillRegistry.ts 共 27 处 calcDamage 调用均未传 `now`，
      damage.ts 里 30+ 处 `(extraOpts as any)?.now ?? 0` 全部退化为 0，
      导致所有 "XxxUntil > now" 判断恒真 —— 护盾减伤/反伤、殉道者降伤、
      龙吟者减伤、祈祷者无敌、火枪手层数等全部永久生效。
修复: 引入模块级战斗时钟，由 processTick 每 tick 同步；所有 now 读取改为 nowOf(extraOpts)。

用法: python scripts/v33_fix_clock.py [--dry-run]
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "src"
DRY = "--dry-run" in sys.argv
DAMAGE = SRC / "engine" / "damage.ts"
BATTLE = SRC / "engine" / "battle.ts"

CLOCK_DECL = """
/**
 * v3.3: 全局战斗时钟。calcDamage 的调用方从未传 `now`，导致所有
 * "XxxUntil > now" 时间判断退化为 >0（buff 永久生效）。由 processTick 每 tick 同步。
 */
let battleClock = 0;
export function setBattleClock(t: number) {
  battleClock = t;
}
function nowOf(extraOpts?: unknown): number {
  const explicit = extraOpts && typeof extraOpts === "object" && "now" in extraOpts
    ? (extraOpts as { now?: number }).now
    : undefined;
  return explicit ?? battleClock;
}

"""

failures: list[str] = []
dmg = DAMAGE.read_text(encoding="utf-8")
btl = BATTLE.read_text(encoding="utf-8")

# 1. 切入减伤：改为无条件应用（该字段每次施法已重置）
dmg, n = re.subn(
    r"attacker\._cutinDmgRed && \(extraOpts as any\)\?\.now !== undefined",
    "attacker._cutinDmgRed", dmg)
if n != 1:
    failures.append(f"切入减伤条件命中 {n} 次")

# 2. 各类 now 表达式统一替换为 nowOf(extraOpts)
patterns = [
    r"\(\(extraOpts as any\)\?\.now \?\? 0\)",
    r"\(\(extraOpts as any\)\?\.now \|\| 0\)",
    r"\(extraOpts as any\)\?\.now \?\? 0",
    r"\(extraOpts as any\)\?\.now \|\| 0",
    r"\(extraOpts as any\)\?\.now",
]
counts = []
for p in patterns:
    dmg, n = re.subn(p, "nowOf(extraOpts)", dmg)
    counts.append(n)
if sum(counts) < 20:
    failures.append(f"now 表达式替换仅 {sum(counts)} 处，预期 >=20")

# 2b. 时钟函数声明必须在替换之后插入，否则函数体自身会被正则误伤
if "function nowOf(" not in dmg:
    idx = dmg.find("import ")
    dmg = dmg[:idx] + CLOCK_DECL + dmg[idx:]

if "(extraOpts as any)?.now" in dmg:
    failures.append("仍残留裸 now 读取")

# 3. battle.ts：导入 setBattleClock 并在 processTick 开头同步时钟
if 'setBattleClock' not in btl:
    m = re.search(r'import \{([^}]*)\} from "\./damage";', btl)
    if not m:
        failures.append("battle.ts 未找到 damage 的 import")
    else:
        old = m.group(0)
        names = m.group(1).strip()
        new = old.replace(names, names + ", setBattleClock") if names else old
        btl = btl.replace(old, new, 1)

clock_call = "  state.time += 0.1;\n  setBattleClock(state.time);"
if "setBattleClock(state.time)" not in btl:
    if btl.count("  state.time += 0.1;") != 1:
        failures.append("processTick 的 state.time += 0.1 锚点不唯一")
    else:
        btl = btl.replace("  state.time += 0.1;", clock_call, 1)

print(f"now 表达式替换: {counts} 共 {sum(counts)} 处 | 失败 {len(failures)} 条")
for f in failures:
    print("  ✗", f)
if failures:
    print("存在失败 → 未写入")
    sys.exit(1)
if DRY:
    print("--dry-run: 未写入")
    sys.exit(0)
DAMAGE.write_text(dmg, encoding="utf-8")
BATTLE.write_text(btl, encoding="utf-8")
print("已写入 engine/damage.ts, engine/battle.ts")
