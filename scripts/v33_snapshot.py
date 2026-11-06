"""v3.3 平衡调整：从 characters.ts 抽取角色数值快照，供文档-代码比对。

用法: python scripts/v33_snapshot.py [输出路径]
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "data" / "characters.ts"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else (
    Path(__file__).resolve().parents[2] / "docs" / "analysis" / "v3.3_character_snapshot.md"
)

text = SRC.read_text(encoding="utf-8")
starts = list(re.finditer(r"^const (\w+): CharacterDef = \{", text, re.M))
rows = []
for i, m in enumerate(starts):
    end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
    block = text[m.start():end]
    cid = m.group(1)

    def grab(pattern, default="-"):
        hit = re.search(pattern, block)
        return hit.group(1).strip() if hit else default

    name = grab(r'name:\s*"([^"]+)"')
    race = grab(r"race:\s*Race\.(\w+)")
    cd = grab(r"cooldown:\s*([\d.]+)")
    cast = grab(r"castTime:\s*([\d.]+)")
    desc = grab(r'description:\s*"([^"]*)"')
    dmg = re.findall(r"atkRatio:\s*([\d.]+)", block)
    dur = re.findall(r"duration:\s*([\d.]+)", block)
    heal = grab(r"heal:\s*\{\s*atkRatio:\s*([\d.]+)")
    tags = grab(r"tags:\s*\[([^\]]*)\]")
    rows.append(
        f"| {cid} | {name} | {race} | {cd} | {cast} | "
        f"{','.join(dmg) or '-'} | {heal} | {','.join(dur) or '-'} | "
        f"{tags} | {desc[:110]} |"
    )

lines = [
    "# V3.3 角色数值快照（characters.ts）",
    "",
    "> 由 `slg-battle/scripts/v33_snapshot.py` 生成；每次批量改动前后各跑一次即可 diff。",
    "",
    "| id | 名称 | 种族 | CD | 施法 | damage倍率 | heal倍率 | effect时长 | tags | description |",
    "|---|---|---|---|---|---|---|---|---|---|",
    *rows,
    "",
]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {OUT} ({len(rows)} characters)")
