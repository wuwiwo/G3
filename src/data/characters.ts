import { CharacterDef, Race, DamageType, StatusType, Row } from "../types";
// v1.5 全角色数据 · Lv.100 裸属性

// ======================== 兽族 ========================

const pp: CharacterDef = {
  id: "pp",
  name: "彭彭猪",
  race: Race.Beast,
  stats: {
    hp: 15460,
    attack: 639,
    physicalDef: 384.8,
    magicalDef: 362,
    attackInterval: 4.2,
  },
  growth: { hp: 140, attack: 6, physicalDef: 3.2, magicalDef: 3 },
  talent: "睡眠时驱散异常+每秒回1%+Lv×0.01%HP（v3.3 回复减半）",
  skill: {
    id: "pp_sleep",
    name: "催眠",
    tags: ["控制", "切入"], // v3.0
    cooldown: 12,
    castTime: 0,
    description:
      "催眠: 随机发动1个效果：①自身与随机1名敌人(优先后排)同睡4s ②自身睡5s+随机2名敌人困意6s命中率-75%",
    scriptId: "pp_sleep",
  },
};

const hl: CharacterDef = {
  id: "hl",
  name: "嚎叫巨牛",
  race: Race.Beast,
  stats: {
    hp: 9924,
    attack: 946,
    physicalDef: 547.2,
    magicalDef: 341.2,
    attackInterval: 4,
  },
  growth: { hp: 90, attack: 9, physicalDef: 4.8, magicalDef: 2.8 },
  talent: "开场怒吼: 敌方全体攻击-30%持续5s，之后-15%持续8s",
  skill: {
    id: "hl_rage",
    name: "激怒",
    tags: ["增益"],
    cooldown: 999,
    castTime: 0,
    description:
      "激怒: 自身HP首次降至60%进入激怒，每3s失去2%最大HP，获得20%减伤+30%攻+50%攻速，免疫异常至战斗结束(每场一次)",
  },
};

const yl: CharacterDef = {
  id: "yl",
  name: "夜行狼人",
  race: Race.Beast,
  stats: {
    hp: 8103,
    attack: 837,
    physicalDef: 390.5,
    magicalDef: 287.5,
    attackInterval: 3,
  },
  growth: { hp: 72, attack: 8, physicalDef: 3.5, magicalDef: 2.5 },
  talent: "开场狼吼: 全兽族攻+30%(每10s衰减20%,最低-60%)",
  skill: {
    id: "yl_stealth",
    name: "潜行",
    tags: ["切入"],
    cooldown: 7,
    castTime: 0,
    description:
      "潜行: 无法被普攻选中(技能可选)、期间不回血；攻击240%+50%吸血，优先后排(前10/中40/后50)，攻击后解除", // v2.36: 2.1→1.9
    damage: [{ type: DamageType.Physical, atkRatio: 2.4 }],
    priority: [
      { row: Row.Back, chance: 50 },
      { row: Row.Mid, chance: 40 },
      { row: Row.Front, chance: 10 },
    ],
    scriptId: "yl_stealth",
  },
};

const hx: CharacterDef = {
  id: "hx",
  name: "虎啸",
  race: Race.Beast,
  stats: {
    hp: 6495,
    attack: 965.8,
    physicalDef: 315.2,
    magicalDef: 210.2,
    attackInterval: 3.5,
  },
  growth: { hp: 55, attack: 9.2, physicalDef: 2.8, magicalDef: 1.8 },
  talent: "兽族阵亡时: 自身攻防各+8%(可叠加,至战斗结束)",
  skill: {
    id: "hx_cut",
    name: "虎袭",
    tags: ["切入"],
    cooldown: 5,
    castTime: 0,
    description: "对随机2名各造成210-240%伤害，优先后排", // v3.4 R3 用户直发
    damage: [{ type: DamageType.Physical, atkRatio: 2.25 }], // R3: 区间中值兜底，handler 覆盖
    aoe: { maxTargets: 2 },
    priority: [
      { row: Row.Back, chance: 60 },
      { row: Row.Mid, chance: 10 },
      { row: Row.Front, chance: 30 },
    ],
  },
};

const zzx: CharacterDef = {
  id: "zzx",
  name: "智慧猩",
  race: Race.Beast,
  stats: {
    hp: 5846,
    attack: 535,
    physicalDef: 297.5,
    magicalDef: 520.5,
    attackInterval: 4,
  },
  growth: { hp: 50, attack: 5, physicalDef: 2.5, magicalDef: 4.5 },
  talent:
    "战斗开始，使敌方同阵型位置所有敌人前7s天赋与技能禁用并失效（不视为异常，无法驱散）",
  skill: {
    id: "zzx_buff",
    name: "鼓舞",
    tags: ["增益"],
    cooldown: 8,
    castTime: 0,
    description:
      "使自身以外1名随机友方(优先兽族)+25%攻7s；自身与目标获得10%物理减伤+20%魔法减伤7s",
    scriptId: "zzx_buff",
  },
};

const dxm: CharacterDef = {
  id: "dxm",
  name: "独行马",
  race: Race.Beast,
  stats: {
    hp: 8820,
    attack: 644,
    physicalDef: 305.5,
    magicalDef: 293.6,
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 6, physicalDef: 2.5, magicalDef: 2.4 },
  talent: "所有友方角色技能冷却减少12%（含自身）",
  skill: {
    id: "dxm_heal",
    name: "治愈",
    tags: ["治疗"],
    cooldown: 6,
    castTime: 0,
    description:
      "治疗我方最低血量1名(优先兽族)：7×等级+攻击×190%；每发动2次，下次治疗+50%并驱散",
    heal: { fixedAdd: 600, atkRatio: 2.25 },
  },
};

const lbmx: CharacterDef = {
  id: "lbmx",
  name: "裂地蛮熊",
  race: Race.Beast,
  stats: {
    hp: 8960,
    attack: 784.5,
    physicalDef: 450.2,
    magicalDef: 274.8,
    attackInterval: 3.3,
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 3.8, magicalDef: 2.2 },
  talent:
    "开场咆哮: 嘲讽敌方随机3名强制攻击自身4s，期间敌方无法使用技能(每场一次)",
  skill: {
    id: "lbmx_smash",
    name: "拍击",
    tags: ["范围"],
    cooldown: 8,
    castTime: 0,
    description:
      "拍击地面: 随机1排全体攻击×200%物理+降20%物防6s（优先前中排，后排-35%，命中3人-35%）", // v3.16f 回滚: 文档220%, // v3.3: 215→225%
    damage: [{ type: DamageType.Physical, atkRatio: 2.0 }],
    aoe: { rows: [Row.Front, Row.Mid], maxTargets: 6 },
  },
};

const mmx: CharacterDef = {
  id: "mmx",
  name: "猛犸象",
  race: Race.Beast,
  stats: {
    hp: 11300,
    attack: 753,
    physicalDef: 560.1,
    magicalDef: 406.6,
    attackInterval: 4,
  },
  growth: { hp: 100, attack: 7, physicalDef: 4.9, magicalDef: 3.4 },
  talent:
    "每间隔12s进入卷曲6s: 攻-20% 防+40%，额外格挡自身防御总和×20%的技能伤害",
  skill: {
    id: "mmx_stomp",
    name: "踩踏",
    tags: ["切入"], // v3.0
    cooldown: 10,
    castTime: 1,
    description:
      "踩踏1名敌人: 75%攻击物理+自身防御×2纯粹（前排+25%，后排缴械3s）", // v3.2: 110→125%
    damage: [
      { type: DamageType.Physical, atkRatio: 0.75 },
      { type: DamageType.Pure, selfDefMultiplier: 2.5 },
    ],
  },
};

// ======================== 猎人 ========================

const sszs: CharacterDef = {
  id: "sszs",
  name: "森之射手",
  race: Race.Hunter,
  stats: {
    hp: 7185,
    attack: 738.8, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 223,
    magicalDef: 198.2,
    attackInterval: 3.5,
  },
  growth: { hp: 65, attack: 8.2, physicalDef: 2, magicalDef: 1.8 },
  talent:
    "获得30%+等级×0.1%闪避(100级40%)；每累计受2次#切入技能，下次#切入技能100%闪避", // v3.0 重做
  skill: {
    id: "sszs_bind",
    name: "束缚射击",
    tags: ["控制"],
    cooldown: 5,
    castTime: 0,
    description: "对1名敌方射击: 攻击×270%物理+束缚4s", // v3.16 用户: 360→280+束缚4s
    damage: [{ type: DamageType.Physical, atkRatio: 2.7 }],
    effects: [{ type: StatusType.Bind, duration: 4 }],
  },
};

const bslr: CharacterDef = {
  id: "bslr",
  name: "冰霜猎人",
  race: Race.Hunter,
  stats: {
    hp: 6640,
    attack: 651.0, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 218,
    magicalDef: 214,
    attackInterval: 3.2,
  },
  growth: { hp: 60, attack: 9, physicalDef: 2, magicalDef: 2 },
  talent:
    "造成伤害37.5%几率无视额外防御并降低目标25%受疗2s；自身受攻击时天赋暂失效1s（技能视为攻击，几率40%）", // v3.4
  skill: {
    id: "bslr_shot",
    name: "持续射击",
    tags: [],
    cooldown: 7,
    castTime: 0,
    description:
      "对敌方1排持续射击1.5s，每0.5秒攻击×90%物理；每次降10%攻或20%攻速4s(最多3层)",
    damage: [{ type: DamageType.Physical, atkRatio: 0.9 }],
    aoe: { maxTargets: 3 },
    scriptId: "bslr_shot",
  },
};

const hqs: CharacterDef = {
  id: "hqs",
  name: "火枪手",
  race: Race.Hunter,
  stats: {
    hp: 8175,
    attack: 694.2, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 216,
    magicalDef: 213,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.6, physicalDef: 2, magicalDef: 2 },
  talent:
    "自身无法被#切入技能选为对象，受到#切入技能伤害为0，自身对后排敌人伤害+10%", // v3.0,
  skill: {
    id: "hqs_snipe",
    name: "狙击",
    tags: [],
    cooldown: 10,
    castTime: 2.5,
    description: "物防最高敌人：物防×4纯粹+攻击×300%物理", // v3.16 用户: 320→300
    damage: [
      { type: DamageType.Pure, defMultiplier: 4 },
      { type: DamageType.Physical, atkRatio: 3.0 }, // v3.16
    ],
  },
};

const mds: CharacterDef = {
  id: "mds",
  name: "美杜莎",
  race: Race.Hunter,
  stats: {
    hp: 8960,
    attack: 670.5, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 250.7,
    magicalDef: 269.5,
    attackInterval: 2.8,
  },
  growth: { hp: 80, attack: 8.0, physicalDef: 2.3, magicalDef: 2.5 },
  talent: "自身攻-12%，同时攻击2名敌人；每攻击2次，下次60%束缚4s / 40%石化2s",
  skill: {
    id: "mds_skill",
    name: "石化凝视",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description: "前中后排各1名敌人: 攻击×135%纯粹+石化3s，自身恢复30%伤害血量", // v3.16 用户: 280魔法+束缚→135纯粹+石化
    damage: [{ type: DamageType.Pure, atkRatio: 1.35 }],
    effects: [{ type: StatusType.Petrify, duration: 3 }],
    scriptId: "mds_skill",
  },
};

const zfyx: CharacterDef = {
  id: "zfyx",
  name: "追风游侠",
  race: Race.Hunter,
  stats: {
    hp: 8075,
    attack: 697.6, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 269.5,
    magicalDef: 217,
    attackInterval: 2.5,
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2.5, magicalDef: 2 },
  talent: "敌方每次发动#切入技能，敌人先受35%伤害，我方全体+10%攻9s(最多4层)", // v3.0 重做,
  skill: {
    id: "zfyx_arrow",
    name: "三连射",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description:
      "发射3枚弓箭，每次攻击×125%随机敌人；每次发射后移动至空位+闪避40% 5s", // v3.16f 回滚: 文档110%
    damage: [{ type: DamageType.Physical, atkRatio: 1.25 }],
    aoe: { maxTargets: 3 },
  },
};

const lxgz: CharacterDef = {
  id: "lxgz",
  name: "灵弦歌者",
  race: Race.Hunter,
  stats: {
    hp: 8620,
    attack: 591.7, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 258.6,
    magicalDef: 237.8,
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 8, physicalDef: 2.4, magicalDef: 2.2 },
  talent:
    "自身治疗或攻击，使我方随机1名获得[激昂]: +10%+等级×0.1%攻与15%攻速，持续5s",
  skill: {
    id: "lxgz_heal",
    name: "治愈琴音",
    tags: ["治疗"],
    cooldown: 8,
    castTime: 2,
    description:
      "弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20%", // v3.16 用户
    heal: { atkRatio: 0.25, targetAtkRatio: 0.15 },
    aoe: { maxTargets: 2 },
  },
};

// ======================== 战士 ========================

const crzs: CharacterDef = {
  id: "crzs",
  name: "炽热战士",
  race: Race.Warrior,
  stats: {
    hp: 8225,
    attack: 896.5,
    physicalDef: 287.5,
    magicalDef: 232,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "每秒失去1%最大HP，受伤+10%，受疗+20%；对敌方同阵型全体每秒造成攻击×1.5%+等级×0.02%纯粹(100级3.5%)",
  skill: {
    id: "crzs_punch",
    name: "灼热拳击",
    tags: [],
    cooldown: 4,
    castTime: 0,
    description:
      "攻击×220%物理+灼烧3s，自受10%反伤（敌方前·中排有角色时不会对后排发动）", // v3.16 用户: 200→220
    damage: [{ type: DamageType.Physical, atkRatio: 2.2 }],
    effects: [{ type: StatusType.Burn, duration: 3, value: 0.05 }],
  },
};

const hd: CharacterDef = {
  id: "hd",
  name: "辉刀",
  race: Race.Warrior,
  stats: {
    hp: 7680,
    attack: 956,
    physicalDef: 271.6,
    magicalDef: 210.2,
    attackInterval: 2.5,
  },
  growth: { hp: 70, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent: "攻击+10%，魔法防御+20%，命中率-15%；攻击未命中受到50%反伤",
  skill: {
    id: "hd_slash",
    name: "斩击",
    tags: ["范围"], // P2修复
    cooldown: 7,
    castTime: 1.5,
    description: "随机1排全体: 攻击×250%物理（命中3人-35%）", // v3.16 用户: 270→250+命中惩罚
    damage: [{ type: DamageType.Physical, atkRatio: 2.5 }],
    aoe: { maxTargets: 3 },
  },
};

const fxz: CharacterDef = {
  id: "fxz",
  name: "分析者",
  race: Race.Warrior,
  stats: {
    hp: 9215,
    attack: 693.5,
    physicalDef: 297.5,
    magicalDef: 297.5,
    attackInterval: 3.5,
  },
  growth: { hp: 85, attack: 6.5, physicalDef: 2.5, magicalDef: 2.5 },
  talent:
    "标记敌人与自身对称的1名角色，其闪避/额外防御归0直到分析者阵亡；之后每35s可分析另一名", // v3.0,
  skill: {
    id: "fxz_analyze",
    name: "分析",
    tags: ["增益"],
    cooldown: 6,
    castTime: 0,
    description:
      "提升自身及2名随机友方最低一项防御6%，持续30s，最多叠10次并重置持续时间", // v3.16 用户: 5→6,
    scriptId: "fxz_analyze",
  },
};

const fdzs: CharacterDef = {
  id: "fdzs",
  name: "风之斗士",
  race: Race.Warrior,
  stats: {
    hp: 9660,
    attack: 951,
    physicalDef: 270.6,
    magicalDef: 207.2,
    attackInterval: 2.5,
  },
  growth: { hp: 90, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent: "对前排造成伤害提升20%+等级×0.1%",
  skill: {
    id: "fdzs_combo",
    name: "疾风连击",
    tags: [],
    cooldown: 6,
    castTime: 1.5,
    description: "1.5s内5次快速攻击，每次攻击目标随机，攻击×65%且无视额外防御", // v3.4 用户直发
    damage: [{ type: DamageType.Physical, atkRatio: 0.65 }],
    aoe: { maxTargets: 1 },
    scriptId: "fdzs_combo",
  },
};

const kzs: CharacterDef = {
  id: "kzs",
  name: "狂战士",
  race: Race.Warrior,
  stats: {
    hp: 6222,
    attack: 621.3,
    physicalDef: 184.4,
    magicalDef: 140.8,
    attackInterval: 2.0,
  },
  growth: { hp: 58, attack: 5.7, physicalDef: 1.6, magicalDef: 1.2 },
  talent: "每损失12%最大HP，提升3%+等级×0.05%攻与8%减伤，最多5层",
  skill: {
    id: "kzs_rage",
    name: "血怒",
    tags: ["增益"],
    cooldown: 10,
    castTime: 0,
    description:
      "消耗10%当前HP进入嗜血: 7s内攻速+80%，每次攻击附加目标当前HP×5%纯粹", // v3.16 用户: 40→60, // 审阅修复: 3→5%
    effects: [{ type: StatusType.Bloodrage, duration: 7 }],
  },
};

const slzs: CharacterDef = {
  id: "slzs",
  name: "圣灵战士",
  race: Race.Warrior,
  stats: {
    hp: 9710,
    attack: 802.5,
    physicalDef: 228,
    magicalDef: 391.5,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7.5, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "每次受魔法伤害50%几率对施法者造成攻×60%+等级×0.25%纯粹并眩晕2s；50%使该次魔伤-50%并治疗随机1名友方",
  skill: {
    id: "slzs_guard",
    name: "守护",
    tags: ["增益"], // v3.0
    cooldown: 13,
    castTime: 0,
    description:
      "消耗6%最大HP进入守护8s: 自身25%减伤、受疗+30%，我方全体友方受到魔法伤害75%几率转移至自身",
    scriptId: "slzs_guard",
  },
};

const zqz: CharacterDef = {
  id: "zqz",
  name: "重拳者",
  race: Race.Warrior,
  stats: {
    hp: 6244,
    attack: 1139.5,
    physicalDef: 278.5,
    magicalDef: 208.2,
    attackInterval: 4.5,
  },
  growth: { hp: 56, attack: 10.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent: "每普通攻击3次，下次攻击附带40%吸血与持续6s的[破甲]",
  skill: {
    id: "zqz_strike",
    name: "毁灭打击",
    tags: ["切入", "控制"], // v3.0
    cooldown: 10,
    castTime: 1,
    description:
      "施法1s，对1名敌方造成攻击×440%物理并眩晕2s，发动后自身也眩晕2s", // v3.16 用户: 340→440
    damage: [{ type: DamageType.Physical, atkRatio: 4.4 }],
    effects: [{ type: StatusType.Stun, duration: 2 }],
    interruptOnAttack: true,
    priority: [{ row: Row.Mid, chance: 100 }],
  },
};

// ======================== 法师 ========================

const xdds: CharacterDef = {
  id: "xdds",
  name: "秀逗大师",
  race: Race.Mage,
  stats: {
    hp: 8670,
    attack: 916.4,
    physicalDef: 193.2,
    magicalDef: 325,
    attackInterval: 3.2,
  },
  growth: { hp: 80, attack: 8.6, physicalDef: 1.8, magicalDef: 3 },
  talent:
    "我方全体法师每次技能+1层秀逗: 每层3%+等级×0.03%攻速+3%技能吸血，7s，最多7层",
  skill: {
    id: "xdds_fire",
    name: "火球",
    tags: [],
    cooldown: 7,
    castTime: 1.5,
    description:
      "对1名敌方造成攻击×220%魔法；每2次升级陨石轰炸(1排+攻击×290%+灼烧3s)，自身获得2层/4层秀逗", // v3.16 用户: 205/250→230/300, // v3.9: 215→205%
    damage: [{ type: DamageType.Magical, atkRatio: 2.2 }],
    priority: [
      { row: Row.Front, chance: 40 },
      { row: Row.Mid, chance: 35 },
      { row: Row.Back, chance: 25 },
    ],
    scriptId: "xdds_fire",
  },
};

const sjsn: CharacterDef = {
  id: "sjsn",
  name: "水晶室女",
  race: Race.Mage,
  stats: {
    hp: 7630,
    attack: 768,
    physicalDef: 166.5,
    magicalDef: 262.6,
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 7, physicalDef: 1.5, magicalDef: 2.4 },
  talent: "除自身外，友方法师技能冷却-10%，技能吸血+10%",
  skill: {
    id: "sjsn_freeze",
    name: "冰封",
    tags: ["控制"],
    cooldown: 7,
    castTime: 0,
    description: "使1名敌方束缚+缴械+每秒攻击×80%魔法，持续3s（无视40%魔防）", // v3.16 用户: 90→80+无视魔防,
    damage: [{ type: DamageType.Magical, atkRatio: 0.8 }],
    effects: [
      { type: StatusType.Bind, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
    ],
    scriptId: "sjsn_freeze",
  },
};

const bmxz: CharacterDef = {
  id: "bmxz",
  name: "白马行者",
  race: Race.Mage,
  stats: {
    hp: 8770,
    attack: 862,
    physicalDef: 163.5,
    magicalDef: 307.2,
    attackInterval: 3,
  },
  growth: { hp: 80, attack: 8, physicalDef: 1.5, magicalDef: 2.8 },
  talent: "友方全场法师每次成功施加异常状态，自身技能减少1s冷却并恢复3%最大HP",
  skill: {
    id: "bmxz_charge",
    name: "蓄力",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "随机蓄力1/2/3s→前排/前中排/全场冲击波: 攻击×200%魔法（命中5名-40%）", // v3.16 用户,
    damage: [{ type: DamageType.Magical, atkRatio: 2.0 }],

    aoe: { maxTargets: 9 },
    scriptId: "bmxz_charge",
  },
};

const srm: CharacterDef = {
  id: "srm",
  name: "食人魔魔法师",
  race: Race.Mage,
  stats: {
    hp: 8500,
    attack: 703.5,
    physicalDef: 348.8,
    magicalDef: 301.2,
    attackInterval: 3.2,
  },
  growth: { hp: 74, attack: 6.5, physicalDef: 3.2, magicalDef: 2.8 },
  talent: "自身攻击获得10%吸血；每当友方阵亡，提升12%最大HP上限并恢复16%最大HP",
  skill: {
    id: "srm_fire",
    name: "火焰爆轰",
    tags: ["控制"],
    cooldown: 5,
    castTime: 0,
    description:
      "消耗3%最大HP，对1敌造成攻击×160%+当前血量×3%魔法并眩晕1s；每2次发动变2倍/3倍效果", // v3.16 用户: 165→180+几率重做, // v2.36: 160→165%
    damage: [{ type: DamageType.Magical, atkRatio: 1.6 }], // P1: 按文档
    effects: [{ type: StatusType.Stun, duration: 1 }],
    scriptId: "srm_fire",
  },
};

const ynfs: CharacterDef = {
  id: "ynfs",
  name: "湮灭法师",
  race: Race.Mage,
  stats: {
    hp: 7630,
    attack: 852,
    physicalDef: 216,
    magicalDef: 321,
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2, magicalDef: 3 },
  talent:
    "战斗开始 1 s 后,使与自身以及与自身对称的 1 名敌方角色暂时传送离开场地。经过 3 s 后自身会返回战斗场地,经过 4+等级 ×0.02 s （100级：6s）后那个敌方角色会返回战斗场地。（最多触发 1 次）", // v3.0,
  skill: {
    id: "ynfs_annihilate",
    name: "湮灭",
    tags: ["控制"],
    cooldown: 9,
    castTime: 3.5,
    description: "2×2格子：目标总防御²/350纯粹+束缚4s",
    damage: [{ type: DamageType.Pure, defSquaredDiv: 350 }],
    aoe: { maxTargets: 4 },
    effects: [{ type: StatusType.Bind, duration: 4 }],
  },
};

const syz: CharacterDef = {
  id: "syz",
  name: "神谕者",
  race: Race.Mage,
  stats: {
    hp: 7730,
    attack: 857,
    physicalDef: 267.5,
    magicalDef: 327,
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 3 },
  talent:
    "每次攻击治疗我方随机1名友方攻×70%(80%几率最低血单位)；阵亡后全场法师10%减伤+每4s全体治疗(前10s 2倍)",
  skill: {
    id: "syz_bless",
    name: "神之庇佑",
    tags: ["增益"], // v3.0
    cooldown: 9, // 审阅修复: 12→10 (文档)
    castTime: 0,
    description:
      "我方最低血量2名友方: 受到治疗+25%、减伤20%+延迟5s结算，持续6s",
    effects: [{ type: StatusType.Inspire, duration: 6, value: 0.8 }], // 审阅修复: 7→5
    scriptId: "syz_bless",
  },
};

// ======================== 亡灵 ========================

const wqqs: CharacterDef = {
  id: "wqqs",
  name: "亡魂骑士",
  race: Race.Undead,
  stats: {
    hp: 7135,
    attack: 812.5,
    physicalDef: 203.2,
    magicalDef: 376.5,
    attackInterval: 3,
  },
  growth: { hp: 65, attack: 7.5, physicalDef: 1.8, magicalDef: 3.5 },
  talent:
    "敌方场上每存在 1 名处于[诅咒]状态的敌人,自身攻击力+5%，闪避率+3%，复活后,该天赋效果+50%",
  skill: {
    id: "wqqs_move",
    name: "亡魂突袭",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description: "随机移动后对1名敌人造成攻击×110%纯粹，并使其受到诅咒5s",
    damage: [{ type: DamageType.Pure, atkRatio: 1.1 }],
    effects: [{ type: StatusType.Curse, duration: 5 }],
  },
};

const kldd: CharacterDef = {
  id: "kldd",
  name: "骷髅大帝",
  race: Race.Undead,
  stats: {
    hp: 9810,
    attack: 852,
    physicalDef: 332,
    magicalDef: 275.5,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 8, physicalDef: 3, magicalDef: 2.5 },
  talent:
    "战斗开始召唤 3 个骷髅兵协助战斗,自身阵亡时我方所有骷髅兵一同阵亡。骷髅兵存在期间，敌方攻击·技能优先对骷髅兵发动。自身复活后,重新召唤 3 个骷髅兵(骷髅兵视为独立单位,与骷髅大帝处于同一格,范围伤害可同时命中骷髅大帝及骷髅兵)",
  skill: {
    id: "kldd_hammer",
    name: "冥火之锤",
    tags: ["控制"], // v3.0
    cooldown: 7,
    castTime: 0,
    description:
      "对1敌造成攻击×150%魔法并眩晕1.5s；4s后追加攻击×75%纯粹，自身恢复25%攻击血量",
    // v3.3: 75%纯粹由 battle.ts 的 4s 延迟结算，此处不再重复立即结算
    damage: [{ type: DamageType.Magical, atkRatio: 1.5 }],
    effects: [{ type: StatusType.Stun, duration: 1.5 }],
  },
};

const klb: CharacterDef = {
  id: "klb",
  name: "骷髅兵",
  race: Race.Undead,
  stats: {
    hp: 1090,
    attack: 218,
    physicalDef: 119,
    magicalDef: 634, // v3.0: 40(+6/级)
    attackInterval: 2.0,
  },
  growth: { hp: 10, attack: 2, physicalDef: 1, magicalDef: 6 }, // v3.0: 5→6,
  talent: "优先攻击冥火之锤目标；无视40%防御；20%伤害治疗骷髅大帝", // P2: 实际20%,
  skill: {
    id: "klb_attack",
    name: "攻击",
    tags: [],
    cooldown: 2,
    castTime: 0,
    description: "普通攻击",
    damage: [{ type: DamageType.Physical, atkRatio: 1.0 }],
  },
};

const yammxz: CharacterDef = {
  id: "yammxz",
  name: "幽暗密行者",
  race: Race.Undead,
  stats: {
    hp: 7035,
    attack: 772.8,
    physicalDef: 168.5,
    magicalDef: 262.6,
    attackInterval: 3.5,
  },
  growth: { hp: 65, attack: 7.2, physicalDef: 1.5, magicalDef: 2.4 },
  talent:
    "每经过 8 s 使与自身同阵型的敌方所有角色陷入[诅咒]状态持续 5 s,复活后,该天赋升级为：每经过 8 s，与自身同阵型的敌方单位陷入[诅咒]与[破坏]状态，持续 6 s", // v3.0,
  skill: {
    id: "yammxz_swap",
    name: "暗影换位",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description: "与友方换位后，使2名随机敌人沉默4s，并造成攻击×120%纯粹伤害",
    damage: [{ type: DamageType.Pure, atkRatio: 1.2 }],
    scriptId: "yammxz_swap",
    effects: [{ type: StatusType.Silence, duration: 4 }],
  },
};

const dyq: CharacterDef = {
  id: "dyq",
  name: "地狱之犬",
  race: Race.Undead,
  stats: {
    hp: 8125,
    attack: 916.5,
    physicalDef: 235.8,
    magicalDef: 257.6,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.2, magicalDef: 2.4 },
  talent:
    "攻击与技能分别有25%几率与45%几率触发[致命一击],造成150%伤害,复活后,致命一击伤害变为190%。[致命一击]与暴击独立判定,若同时触发取伤害较高者。",
  skill: {
    id: "dyq_dash",
    name: "冲刺",
    tags: ["移动"],
    cooldown: 5,
    castTime: 0,
    description:
      "对同列竖排全体造成攻击×130%魔法，30%几率诅咒4s（命中3人-30%）",
    damage: [{ type: DamageType.Magical, atkRatio: 1.3 }],
    effects: [{ type: StatusType.Burn, duration: 4, value: 0.05, chance: 0.3 }],
    aoe: { maxTargets: 3 },
  },
};

// ======================== 龙族 ========================

const hlyl: CharacterDef = {
  id: "hlyl",
  name: "火焰翼龙",
  race: Race.Dragon,
  stats: {
    hp: 8720,
    attack: 802.5,
    physicalDef: 162.6,
    magicalDef: 374.6,
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 1.4, magicalDef: 3.4 },
  talent:
    "我方场上每存在 1 只非龙族角色，自身攻击力-5%，每存在 1 只龙族角色，自身攻击+5%（不含自身），我方其他龙族+3%攻击",
  skill: {
    id: "hlyl_fire",
    name: "火焰喷吐",
    tags: [],
    cooldown: 7,
    castTime: 1,
    description: "对1名敌人造成每秒攻击×35%魔法伤害，持续7s",
    damage: [{ type: DamageType.Magical, atkRatio: 0.35 }],
    aoe: { maxTargets: 1 },
    scriptId: "hlyl_fire",
  },
};

const bsxl: CharacterDef = {
  id: "bsxl",
  name: "冰霜邪龙",
  race: Race.Dragon,
  stats: {
    hp: 8700,
    attack: 693.5,
    physicalDef: 223,
    magicalDef: 379.5,
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 6.5, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "我方场上每存在 1 只非龙族角色，自身防御-5%，每存在 1 只龙族角色，自身防御+5%（不含自身）其他龙族+2%防御",
  skill: {
    id: "bsxl_freeze",
    name: "冰霜吐息",
    tags: ["控制"],
    cooldown: 10,
    castTime: 1,
    description:
      "随机1排敌人: 降40%攻速+每秒攻击×60%魔法伤害4s；每2次发动，下次降攻速变为[冰冻]",
    damage: [{ type: DamageType.Magical, atkRatio: 0.6 }],
    aoe: { maxTargets: 3 },
    scriptId: "bsxl_freeze",
  },
};

const xyfl: CharacterDef = {
  id: "xyfl",
  name: "血翼飞龙",
  race: Race.Dragon,
  stats: {
    hp: 8920,
    attack: 916.5,
    physicalDef: 220,
    magicalDef: 346.8,
    attackInterval: 3,
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 3.2 },
  talent:
    "我方场上每存在 1 只非龙族角色，自身受到异常状态持续时间+4%，每存在 1 只龙族角色，自身受到异常状态持续时间-4%（不含自身）其他龙族受到异常状态持续时间-2%",
  skill: {
    id: "xyfl_chaos",
    name: "乱序打击",
    tags: ["控制"],
    cooldown: 9,
    castTime: 1,
    description: "随机4名敌人受到攻击×240%物理，并随机打乱它们之间的位置", // v3.15g: 220→260（对齐 handler）
    damage: [{ type: DamageType.Physical, atkRatio: 2.4 }],
    aoe: { maxTargets: 6 },
    scriptId: "xyfl_chaos",
  },
};

const hbfl: CharacterDef = {
  id: "hbfl",
  name: "寒冰飞龙",
  race: Race.Dragon,
  stats: {
    hp: 7680,
    attack: 646,
    physicalDef: 275.5,
    magicalDef: 243.8,
    attackInterval: 3,
  },
  growth: { hp: 70, attack: 6, physicalDef: 2.5, magicalDef: 2.2 },
  talent:
    "我方场上每存在 1 只非龙族角色，自身技能冷却+4%，每存在 1 只龙族角色，自身技能冷却-4%（不含自身）其他龙族技能冷却-2%",
  skill: {
    id: "hbfl_heal",
    name: "冰封治疗",
    tags: ["治疗"],
    cooldown: 10,
    castTime: 1,
    description:
      "冰封<75%HP龙族4s（免疫物理，被冰封无法行动），每秒提供攻击×70%+最大HP×3%治疗", // P1修复: 按文档60%/6%
    heal: { atkRatio: 0.7, targetMaxHpRatio: 0.06 },
  },
};

const bjl: CharacterDef = {
  id: "bjl",
  name: "暴君龙",
  race: Race.Dragon,
  stats: {
    hp: 8850,
    attack: 975.8,
    physicalDef: 221,
    magicalDef: 353.7,
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 9.2, physicalDef: 2, magicalDef: 3.3 },
  talent:
    "战斗开始，发出吼叫，使全场非龙族角色防御力降低 30%+等级×0.15%（100级：-45%防御），这个效果每 5 s 减少 15%，最低降至原本的 25%", // v3.0: 6→5s,
  skill: {
    id: "bjl_wing",
    name: "翅击",
    tags: ["切入"],
    cooldown: 9,
    castTime: 0,
    description: "中后排各1名: 第1个200%物伤+30%降攻速4s，第2个240%物伤", // v3.15c: 180/230→210/260
    damage: [
      { type: DamageType.Physical, atkRatio: 2.0 },
      { type: DamageType.Physical, atkRatio: 2.4 },
    ],
    aoe: { maxTargets: 2 },
    scriptId: "bjl_wing",
  },
};

// ======================== 导出 ========================

const zs: CharacterDef = {
  id: "zs",
  name: "宙斯",
  race: Race.Mage,
  stats: {
    hp: 8820,
    attack: 931.5,
    physicalDef: 218,
    magicalDef: 281.5,
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 2.5 },
  talent: "自身攻击/技能各有35%/75%几率附加目标当前HP×8%的魔法伤害",
  skill: {
    id: "zs_storm",
    name: "神之怒雷",
    tags: [],
    cooldown: 10,
    castTime: 2,
    description: "全屏攻击×160-180%魔法", // v2.35 宙斯 1.65→1.7
    damage: [{ type: DamageType.Magical, atkRatio: 1.7 }],
    aoe: { maxTargets: 9 },
    interruptOnAttack: true,
  },
};

const xjl: CharacterDef = {
  id: "xjl",
  name: "小精灵",
  race: Race.Mage,
  stats: {
    hp: 8500,
    attack: 748,
    physicalDef: 322,
    magicalDef: 272.5,
    attackInterval: 4.5,
  },
  growth: { hp: 75, attack: 7, physicalDef: 3, magicalDef: 2.5 },
  talent:
    "每秒恢复1%最大HP；我方全场每次技能对敌造成伤害，自身恢复1%最大HP（每2s最多5%）",
  skill: {
    id: "xjl_link",
    name: "链接",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "链接1名友方8s: +30%技能增强+双方天赋20%效果，自身代替友方承担25%伤害",
    scriptId: "xjl_link",
  },
};

const swxz: CharacterDef = {
  id: "swxz",
  name: "死亡先知",
  race: Race.Undead,
  stats: {
    hp: 9365, // v3.3 成长-15%: 950+85×99
    attack: 797.5,
    physicalDef: 329,
    magicalDef: 358.8,
    attackInterval: 3.6,
  },
  growth: { hp: 85, attack: 7.5, physicalDef: 3, magicalDef: 3.2 }, // v3.3 100→85
  talent:
    "自身每累积造成800伤害，获得3%伤害减免直到战斗结束（最多10层，计算实际伤害）", // v3.0,
  skill: {
    id: "swxz_drain",
    name: "吸魂巫术",
    tags: [],
    cooldown: 7,
    castTime: 0,
    description:
      "吸取1单位10s: 每秒造成自身攻击×6%+目标最大HP×1%魔法，自身获得15%技能吸血。优先前排(70/15/15)",
    scriptId: "swxz_drain",
    priority: [
      { row: Row.Front, chance: 70 },
      { row: Row.Mid, chance: 15 },
      { row: Row.Back, chance: 15 },
    ],
  },
};

const xcl: CharacterDef = {
  id: "xcl",
  name: "星辰龙",
  race: Race.Dragon,
  stats: {
    hp: 5948,
    attack: 832.2,
    physicalDef: 228.9,
    magicalDef: 322,
    attackInterval: 3,
  },
  growth: { hp: 52, attack: 7.8, physicalDef: 2.1, magicalDef: 3 },
  talent:
    "（星辰驱逐）使场上第一个发动技能的非龙族角色暂时离开场上3s，回归后那个技能变为冷却状态。（那次技能发动无效）",
  skill: {
    id: "xcl_star",
    name: "星辰冲击",
    tags: ["控制"],
    cooldown: 11,
    castTime: 2,
    description:
      "2×2随机格子上的敌人受到攻击×170%魔法，并各有20%沉默/20%缴械3s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.7 }],
    aoe: { maxTargets: 4 },
    effects: [
      { type: StatusType.Silence, duration: 3, chance: 0.2 },
      { type: StatusType.Disarm, duration: 3, chance: 0.2 },
    ],
  },
};

const dl: CharacterDef = {
  id: "dl",
  name: "地龙",
  race: Race.Dragon,
  stats: {
    hp: 7730,
    attack: 862,
    physicalDef: 274.5,
    magicalDef: 223,
    attackInterval: 3.3,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 2 },
  talent: "粗暴龙皮: 受到普攻随机发动①攻击者受自身攻击×12%纯粹 ②该次伤害-30%", // v3.0 重写,
  skill: {
    id: "dl_stomp",
    name: "龙踏",
    tags: ["控制"],
    cooldown: 11,
    castTime: 2,
    description:
      "敌方全体攻击×150%物理（前排130%/中排100%/后排70%），并降低20%命中率5s", // v3.8: 145→150%
    damage: [{ type: DamageType.Physical, atkRatio: 1.5 }],
    aoe: { maxTargets: 9 },
    scriptId: "dl_stomp",
  },
};

const lyz: CharacterDef = {
  id: "lyz",
  name: "龙吟者",
  race: Race.Dragon,
  stats: {
    hp: 9465,
    attack: 644,
    physicalDef: 287.4,
    magicalDef: 350.8,
    attackInterval: 5,
  },
  growth: { hp: 85, attack: 6, physicalDef: 2.6, magicalDef: 3.2 },
  talent:
    "自身只能放置在前排，如果因其他技能/天赋而离开前排，每秒失去3%最大生命值。场上每存在1只龙族角色提升自身5%防御力，每存在1只非龙族角色降低自身4%防御力（数双方场上角色，包含自身）。",
  skill: {
    id: "lyz_heal",
    name: "龙吟治愈",
    tags: ["治疗", "增益"], // v3.0
    cooldown: 10,
    castTime: 2,
    description:
      "治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每4次后下次升级，若有阵亡龙族随机复活1只并无敌5s",
    heal: { atkRatio: 0.4 },
    scriptId: "lyz_heal",
  },
};

const xblr: CharacterDef = {
  id: "xblr",
  name: "西部猎人",
  race: Race.Hunter,
  stats: {
    hp: 8342,
    attack: 721.4, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 248.7,
    magicalDef: 236.8,
    attackInterval: 2.8,
  },
  growth: { hp: 78, attack: 10, physicalDef: 2.3, magicalDef: 2.2 },
  talent:
    "我方全体猎人每次攻击，自身额外对该目标进行一次10%伤害的攻击，该攻击暴击率+35%", // v3.0 重做,
  skill: {
    id: "xblr_shot",
    name: "跳跃射击",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description: "跳至空位后，对2名敌人各3发攻击：90%/100%/120%，第3发必暴击", // v3.16 用户: 120→110,
    damage: [{ type: DamageType.Physical, atkRatio: 0.97 }],
    aoe: { maxTargets: 3 },
    scriptId: "xblr_shot",
  },
};

const ldshz: CharacterDef = {
  id: "ldshz",
  name: "林地守护者",
  race: Race.Hunter,
  stats: {
    hp: 10110,
    attack: 523.4, // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 361.8,
    magicalDef: 337,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7, physicalDef: 3.2, magicalDef: 3 },
  talent: "自身HP>90%时受伤-60%，HP>40%时受伤-30%",
  skill: {
    id: "ldshz_buff",
    name: "自然守护",
    tags: ["增益"],
    cooldown: 8,
    castTime: 0,
    description:
      "使自身及随机2名友方获得护盾(自身攻×600%)6s；护盾破碎时我方全场获得30%护盾值治疗", // v3.16 用户: 30→35,
    scriptId: "ldshz_buff",
  },
};

const jdds: CharacterDef = {
  id: "jdds",
  name: "决斗大师",
  race: Race.Warrior,
  stats: {
    hp: 8225,
    attack: 812.5,
    physicalDef: 279.5,
    magicalDef: 208.2,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 7.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent:
    "我方全体战士每次击杀，自身受当前攻×10%反冲，之后+3%+等级×0.02%攻与5%防直到战斗结束", // v3.0,
  skill: {
    id: "jdds_steal",
    name: "战力夺舍",
    tags: [],
    cooldown: 6,
    castTime: 0,
    description: "夺取敌方攻最高角色20%攻击力5s", // v3.16 用户: 20→30,
    scriptId: "jdds_steal",
  },
};

// ===== v1.6.4 数值调整 =====

const wlgyz: CharacterDef = {
  id: "wlgyz",
  name: "亡灵歌咏者",
  race: Race.Undead,
  stats: {
    hp: 8225,
    attack: 644,
    physicalDef: 220,
    magicalDef: 391.5,
    attackInterval: 3.6,
  },
  growth: { hp: 75, attack: 6, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "敌方场上处于[诅咒]状态的敌人每秒受到目标自身攻击力×1%+自身等级×0.6的纯粹伤害,复活后,该天赋效果+50%",
  skill: {
    id: "wlgyz_heal",
    name: "死亡颂歌",
    tags: ["治疗", "减益"],
    cooldown: 8,
    castTime: 2,
    description: "施法2s，恢复随机2名友方攻击×160%生命，并诅咒随机1名敌方5s",
    heal: { atkRatio: 1.6 },
    aoe: { maxTargets: 2 },
    effects: [{ type: StatusType.Curse, duration: 5 }],
  },
};

const mrsz: CharacterDef = {
  id: "mrsz",
  name: "末日使者",
  race: Race.Undead,
  stats: {
    hp: 7394,
    attack: 1046.1,
    physicalDef: 178.4,
    magicalDef: 263.6,
    attackInterval: 3.5,
  },
  growth: { hp: 66, attack: 9.9, physicalDef: 1.6, magicalDef: 2.4 },
  talent: "攻击异常状态敌人造成伤害+10%，获得20%吸血，复活后效果2倍",
  skill: {
    id: "mrsz_doom",
    name: "末日",
    tags: ["控制"],
    cooldown: 14,
    castTime: 0,
    description:
      "消耗6%最大HP，锁定近10s伤害最高目标: 受疗-75%、每秒13%×攻击纯粹、[沉默]+[破坏]8s（HP<15%不可用）",
    scriptId: "mrsz_doom",
  },
};

const hyz: CharacterDef = {
  id: "hyz",
  name: "魂之引渡者",
  race: Race.Undead,
  stats: {
    hp: 6640,
    attack: 644,
    physicalDef: 194.2,
    magicalDef: 369.5,
    attackInterval: 3.2,
  },
  growth: { hp: 60, attack: 6, physicalDef: 1.8, magicalDef: 3.5 },
  talent:
    "每4s或每当我方对敌施加负面状态(每次动作1层)获得1层魂能，最多5层；每层攻+5%防+10%；复活后立即获得5层",
  skill: {
    id: "hyz_shield",
    name: "魂能护盾",
    tags: ["移动", "增益"], // v3.0
    cooldown: 13,
    castTime: 0,
    description:
      "消耗全部魂能，瞬移至1个空位；使随机1名友方驱散全部负面，自身与目标获得护盾(攻击×80%×层数)",
    scriptId: "hyz_shield",
  },
};

const fz: CharacterDef = {
  id: "fz",
  name: "符咒大师",
  race: Race.Holy,
  stats: {
    hp: 10120, // v3.7 ×1.15
    attack: 1029.7, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 222,
    magicalDef: 141.3, // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 5.6, physicalDef: 2, magicalDef: 0.8 },
  talent:
    "每次攻击随机2选1: ①伤害降低20%变纯粹 ②对目标叠1层符咒印记(直到自身阵亡或目标移动/阵亡)",
  skill: {
    id: "fz_curse",
    name: "符咒",
    tags: [],
    cooldown: 5,
    castTime: 1,
    description: "对1名敌人造成攻击×80%魔法伤害，目标每层符咒印记+8%伤害", // v3.15g: 95→85
    damage: [{ type: DamageType.Magical, atkRatio: 0.8 }],
    scriptId: "fz_curse",
  },
};

const qm: CharacterDef = {
  id: "qm",
  name: "驱魔者",
  race: Race.Holy,
  stats: {
    hp: 9458, // v3.7 ×1.15
    attack: 1029.7, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 168.5,
    magicalDef: 572.2, // v3.7 ×1.5
    attackInterval: 3.5,
  },
  growth: { hp: 75, attack: 6.5, physicalDef: 1.5, magicalDef: 3.5 },
  talent: "受到异常状态后提升6%攻与20%防，持续12s（最多5层）",
  skill: {
    id: "qm_exorcise",
    name: "驱魔",
    tags: ["范围"],
    cooldown: 8,
    castTime: 1,
    description: "敌方随机2×2范围: 攻击×105%魔法，目标有增益状态→伤害变纯粹", // v3.15g: 115→105
    damage: [{ type: DamageType.Magical, atkRatio: 1.05 }],
    aoe: { maxTargets: 4 },
    scriptId: "qm_exorcise",
  },
};

const sq: CharacterDef = {
  id: "sq",
  name: "圣骑士",
  race: Race.Holy,
  stats: {
    hp: 16675, // v3.7 ×1.15 // v3.5: 圣职者加强
    attack: 758.7, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 446,
    magicalDef: 669.0, // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 90, attack: 5, physicalDef: 4, magicalDef: 4 },
  talent: "自身不会陷入[沉默]/[破坏]/[缴械]/[诅咒]状态",
  skill: {
    id: "sq_heal",
    name: "圣光治愈",
    tags: ["治疗"],
    cooldown: 12,
    castTime: 0,
    description:
      "我方2名圣职者恢复攻击×120%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s", // v3.15g: 125→115 // v3.5: 200→240%
    heal: { fixedAdd: 0, atkRatio: 1.2 },
    scriptId: "sq_heal",
  },
};

const qd: CharacterDef = {
  id: "qd",
  name: "祈祷者",
  race: Race.Holy,
  stats: {
    hp: 8510, // v3.7 ×1.15
    attack: 975.5, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5
    physicalDef: 218,
    magicalDef: 172.5, // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 60, attack: 7.5, physicalDef: 2, magicalDef: 1 },
  talent:
    "我方所有角色每次技能后，对敌方随机1名造成攻击×3%纯粹，并治疗我方随机1名攻击×3%",
  skill: {
    id: "qd_pray",
    name: "祈祷",
    tags: ["治疗", "增益"], // v3.0 用户指定
    cooldown: 9,
    castTime: 3,
    description:
      "施法3s后随机祈祷: 大成功(自身无敌+每秒2%最大HP×5s)/成功(自身减伤40%+每秒1%×5s)/一般(自身减伤20%×5s)/失败(自损10%最大HP)",
    scriptId: "qd_pray",
  },
};

const sqz: CharacterDef = {
  id: "sqz",
  name: "圣拳者",
  race: Race.Holy,
  stats: {
    hp: 8774, // v3.7 ×1.15
    attack: 975.5, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 265.6,
    magicalDef: 160.6, // v3.7 ×1.5
    attackInterval: 2.4,
  },
  growth: { hp: 70, attack: 6.0, physicalDef: 2.4, magicalDef: 0.9 },
  talent: "自身每次攻击有40%几率使伤害降低20%，那次伤害类型变为纯粹",
  skill: {
    id: "sqz_combo",
    name: "圣拳连击",
    tags: ["切入"],
    cooldown: 5,
    castTime: 0,
    description: "对敌方后排1名造成3次攻击，每次攻击×70%（后排无人→中前排）", // v3.5: 80→95%
    damage: [{ type: DamageType.Physical, atkRatio: 0.7 }],
    aoe: { maxTargets: 1 },
    scriptId: "sqz_combo",
  },
};

const zq: CharacterDef = {
  id: "zq",
  name: "朱雀之神",
  race: Race.Holy,
  stats: {
    hp: 9085, // v3.7 ×1.15
    attack: 1083.8, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5
    physicalDef: 117,
    magicalDef: 454.8, // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 66, attack: 8.5, physicalDef: 1, magicalDef: 2.8 },
  talent: "自身攻击变为魔法伤害",
  skill: {
    id: "zq_flame",
    name: "朱雀焚天",
    tags: [],
    cooldown: 8,
    castTime: 2,
    description: "对敌方随机1排造成攻击×180%魔法伤害，并灼烧4s", // v3.15g: 150→135
    damage: [{ type: DamageType.Magical, atkRatio: 1.8 }],
    scriptId: "zq_flame",
  },
};

const sc: CharacterDef = {
  id: "sc",
  name: "圣裁者",
  race: Race.Holy,
  stats: {
    hp: 13224, // v3.7 ×1.15 // v3.5: 圣职者加强
    attack: 751.7, // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15
    physicalDef: 401.4,
    magicalDef: 393.9, // v3.7 ×1.5
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 6.4, physicalDef: 3.6, magicalDef: 2.4 },
  talent: "敌方场上每存在1名拥有增益状态的单位，自身获得6%伤害减免",
  skill: {
    id: "sc_judge",
    name: "审判之光",
    tags: [],
    cooldown: 11,
    castTime: 2,
    description:
      "对最近9s累计伤害最高敌人: 沉默+每秒自身攻击×35%纯粹持续4s；目标有增益则用目标攻击力计算，效果结束后清除其全部增益",
    scriptId: "sc_judge",
  },
};

const xd: CharacterDef = {
  id: "xd",
  name: "殉道者",
  race: Race.Holy,
  stats: {
    hp: 7520, // v3.7 ×1.15
    attack: 1048.4, // v3.4 R5 成长 7→6: 454.4+6×99（1级base不变） // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 168.5,
    magicalDef: 252.8, // v3.7 ×1.5
    attackInterval: 3,
  },
  growth: { hp: 60, attack: 6.0, physicalDef: 1.5, magicalDef: 1.5 }, // v3.4 R5 7.0→6.0
  talent:
    "每当友方角色阵亡，给予敌方全体自身攻击×30%纯粹，我方剩余单位恢复最大生命×5%", // P2,
  skill: {
    id: "xd_sacrifice",
    name: "牺牲",
    tags: ["嘲讽"],
    cooldown: 8,
    castTime: 0,
    description:
      "使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续4s；自身阵亡后仍可发动，冷却+100%且无降伤效果，只造成25%伤害",
    scriptId: "xd_sacrifice",
  },
};

export const ALL_CHARACTERS: CharacterDef[] = [
  pp,
  hl,
  yl,
  hx,
  zzx,
  dxm,
  lbmx,
  mmx,
  sszs,
  bslr,
  hqs,
  mds,
  zfyx,
  lxgz,
  xblr,
  ldshz,
  crzs,
  hd,
  fxz,
  fdzs,
  kzs,
  slzs,
  zqz,
  jdds,
  xdds,
  sjsn,
  bmxz,
  srm,
  ynfs,
  syz,
  zs,
  xjl,
  wqqs,
  wlgyz,
  kldd,
  yammxz,
  dyq,
  hyz,
  mrsz,
  swxz,
  hlyl,
  bsxl,
  xyfl,
  hbfl,
  bjl,
  lyz,
  xcl,
  dl,
  fz,
  qm,
  sq,
  qd,
  sqz,
  zq,
  sc,
  xd,
];

/**
 * v3.3: 召唤物不进入可部署角色池（TeamSetup/DataEditor），但必须能被
 * CHARACTER_MAP 查到，否则骷髅大帝的召唤天赋会静默空转。
 */
export const SUMMON_CHARACTERS: CharacterDef[] = [klb];

export const CHARACTER_MAP = buildCharacterMap();

function buildCharacterMap(): Map<string, CharacterDef> {
  let overrides: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) overrides = JSON.parse(raw);
  } catch {}
  return new Map(
    [...ALL_CHARACTERS, ...SUMMON_CHARACTERS].map((c) => {
      const ov = overrides[c.id];
      if (!ov) return [c.id, c];
      return [
        c.id,
        {
          ...c,
          stats: { ...c.stats, ...ov.stats },
          growth: { ...c.growth, ...ov.growth },
          talent: ov.talent ?? c.talent,
          skill: ov.skill ? { ...c.skill, ...ov.skill } : c.skill,
        },
      ];
    })
  );
}

/** Rebuild CHARACTER_MAP after custom data changes */
export function refreshCharacterMap() {
  const newMap = buildCharacterMap();
  CHARACTER_MAP.clear();
  for (const [k, v] of newMap) CHARACTER_MAP.set(k, v);
}
