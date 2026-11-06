"""v3.3：把 V3.3 角色天赋/技能描述同步进设计文档 docs/v3.0.md 的对应角色章节。

只改每个 `##### 角色名` 章节内的单行 `* 技能:` / `* 天赋:` 行，保留台词、属性、
装备等其它内容；冷却值从 characters.ts 读取，保证与引擎一致。
"""
import importlib.util
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parent
DOC = ROOT / "docs" / "v3.0.md"

spec = importlib.util.spec_from_file_location("v33_apply", BASE / "scripts" / "v33_apply.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
CHARS = mod.CHARS

code = (BASE / "src" / "data" / "characters.ts").read_text(encoding="utf-8")
name_to_cd = {}
name_to_tags = {}
name_to_cast = {}
id_to_name = {}
for m in re.finditer(r"^const (\w+): CharacterDef = \{(.*?)(?=^const \w+: CharacterDef = \{|\Z)",
                     code, re.M | re.S):
    cid, block = m.group(1), m.group(2)
    nm = re.search(r'name:\s*"([^"]+)"', block)
    cd = re.search(r"cooldown:\s*([\d.]+)", block)
    tg = re.search(r"tags:\s*\[([^\]]*)\]", block)
    ct = re.search(r"castTime:\s*([\d.]+)", block)
    if nm:
        cname = nm.group(1)
        id_to_name[cid] = cname
        if cd:
            name_to_cd[cname] = cd.group(1)
        if tg:
            labels = re.findall(r'"([^"]+)"', tg.group(1))
            name_to_tags[cname] = " ".join(f"#{t}" for t in labels)
        if ct and float(ct.group(1)) > 0:
            name_to_cast[cname] = ct.group(1)
# CHARS 以 id 为键，文档章节以中文名为标题
SPECS = {id_to_name[cid]: sp for cid, sp in CHARS.items() if cid in id_to_name}

doc = DOC.read_text(encoding="utf-8")
heads = list(re.finditer(r"^##### (.+)$", doc, re.M))
changed = []
# 倒序处理，保持前面章节的绝对偏移
for i in range(len(heads) - 1, -1, -1):
    h = heads[i]
    name = h.group(1).strip()
    spec_c = SPECS.get(name)
    if not spec_c:
        continue
    begin = h.end()
    end = heads[i + 1].start() if i + 1 < len(heads) else len(doc)
    seg = doc[begin:end]
    if "desc" in spec_c and name in name_to_cd:
        cd = name_to_cd[name]
        tags = name_to_tags.get(name, "")
        cast = f" 施法:{name_to_cast[name]} s" if name in name_to_cast else ""
        prefix = f"{tags} " if tags else ""
        newline = f"* 技能: {prefix}{spec_c['desc']}{cast} (冷却:{cd} s)"
        seg2, n = re.subn(r"^\*\s*技能[:：].*$", lambda _: newline, seg, count=1, flags=re.M)
        if n:
            seg = seg2
            changed.append(f"{name}.技能")
    if "talent" in spec_c:
        newline = f"* 天赋: {spec_c['talent']}"
        seg2, n = re.subn(r"^\*\s*天赋[:：].*$", lambda _: newline, seg, count=1, flags=re.M)
        if n:
            seg = seg2
            changed.append(f"{name}.天赋")
    doc = doc[:begin] + seg + doc[end:]

DOC.write_text(doc, encoding="utf-8")
print(f"同步 {len(changed)} 处角色条目 → {DOC}")
