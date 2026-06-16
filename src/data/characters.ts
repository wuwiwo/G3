import { CharacterDef, Race, DamageType, StatusType, Row } from "../types";
// v1.5 全角色数据 · Lv.100 裸属性

// ======================== 兽族 ========================

const pp: CharacterDef = {
  id: "pp",
  name: "彭彭猪",
  race: Race.Beast,
  stats: {
    hp: 13280,
    attack: 639,
    physicalDef: 384.8,
    magicalDef: 362,
    attackInterval: 4.5,
  },
  growth: { hp: 120, attack: 6, physicalDef: 3.2, magicalDef: 3 },
  talent: "睡眠时驱散异常+每秒回2%+Lv×0.02%HP",
  skill: {
    id: "pp_sleep",
    name: "催眠",
    tags: ["控制"],
    cooldown: 11,
    castTime: 0,
    description: "令自身与敌人后排随机一名同时进入睡眠3s(后排无人只对自己)",
    effects: [{ type: StatusType.Sleep, duration: 3, chance: 0.5 }],
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
  talent:
    "战斗开始发出怒吼威吓敌人,使敌人全部角色攻击力降低 15%+等级×0.15%（100级时候降低 25%）,持续 5+等级×0.03 s（100级：8s）",
  skill: {
    id: "hl_rage",
    name: "激怒",
    tags: ["增益"],
    cooldown: 999,
    castTime: 0,
    description: "首次HP<25%时，提升35%攻击+20%攻速，免疫异常至战斗结束",
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
  talent:
    "战斗开始,发出狼吼,使我方全场兽族提升 20%+等级×0.1%的攻击力,持续至战斗结束。但这个效果每经过 10 s 后减少 20%,最多降低 60%（100级：+30%攻击）",
  skill: {
    id: "yl_stealth",
    name: "潜行",
    tags: ["切入"],
    cooldown: 8,
    castTime: 0,
    description: "潜行(不可选中)，每秒回1%HP，下次攻击2.1倍，优先后排",
    damage: [{ type: DamageType.Physical, atkRatio: 2.1 }],
    priority: [
      { row: Row.Back, chance: 50 },
      { row: Row.Mid, chance: 40 },
      { row: Row.Front, chance: 10 },
    ],
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
  talent:
    "我方场上每次兽族角色阵亡,自身提升 6%+等级×0.02%的攻击与 3%+等级×0.05%的防御力,直到战斗结束。（100级：8%攻击与8%防御力/个）",
  skill: {
    id: "hx_cut",
    name: "虎袭",
    tags: ["切入"],
    cooldown: 5,
    castTime: 0,
    description: "对随机2名各造成200-240%伤害，优先后排",
    damage: [{ type: DamageType.Physical, atkRatio: 2.2 }],
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
    "战斗开始,根据自身所在阵型位置,使敌方对应阵型位置的所有敌人,战斗开始后的前 4+等级×0.04 s 的天赋与技能禁用并失效。",
  skill: {
    id: "zzx_buff",
    name: "鼓舞",
    tags: ["增益"],
    cooldown: 9,
    castTime: 0,
    description: "使一名友方（优先兽族）提升40%攻击力5s+自身与目标双抗7s",
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
  talent:
    "与自身同阵型（即同一排，前/中/后排取决于自身位置）的所有友方角色技能冷却减少 10%+等级×0.08%（包含自身）（100级：-18%技能冷却）",
  skill: {
    id: "dxm_heal",
    name: "治愈",
    tags: ["治疗"],
    cooldown: 7,
    castTime: 0,
    description: "治疗最低血量友方（优先兽族）：5×等级+攻击×170%",
    heal: { fixedAdd: 600, atkRatio: 1.7 },
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
    "开场咆哮,嘲讽敌方前排所有角色强制攻击自身 2+等级×0.03 s,该期间敌方无法使用技能(每场仅一次)（100级：5s）",
  skill: {
    id: "lbmx_smash",
    name: "拍击",
    tags: ["范围"],
    cooldown: 8,
    castTime: 0,
    description: "前中排全体攻击×190%物理+降20%攻速5s（后排-40%伤害）",
    damage: [{ type: DamageType.Physical, atkRatio: 1.9 }],
    aoe: { rows: [Row.Front, Row.Mid], maxTargets: 6 },
  },
};

const ds: CharacterDef = {
  id: "ds",
  name: "洞狮",
  race: Race.Beast,
  stats: {
    hp: 7780,
    attack: 806.5,
    physicalDef: 300.2,
    magicalDef: 287.4,
    attackInterval: 3.5,
  },
  growth: { hp: 70, attack: 7.5, physicalDef: 2.8, magicalDef: 2.6 },
  talent: "自身不会被其他天赋·效果而降低攻击·防御",
  skill: {
    id: "ds_bite",
    name: "撕咬",
    tags: ["切入", "控制", "吸血"],
    cooldown: 9,
    castTime: 0,
    description: "撕咬1名敌人，每秒攻击×65%+10纯粹伤害+无法行动，自身恢复20%",
    damage: [{ type: DamageType.Pure, atkRatio: 0.65, fixedAdd: 10 }],
    priority: [
      { row: Row.Back, chance: 50 },
      { row: Row.Mid, chance: 30 },
      { row: Row.Front, chance: 20 },
    ],
  },
};

const mmx: CharacterDef = {
  id: "mmx",
  name: "猛犸象",
  race: Race.Beast,
  stats: {
    hp: 11250,
    attack: 753,
    physicalDef: 490.8,
    magicalDef: 386.8,
    attackInterval: 4,
  },
  growth: { hp: 100, attack: 7, physicalDef: 4.2, magicalDef: 3.2 },
  talent:
    "每间隔 7 s 进入卷曲状态,期间攻击力降低 25%,防御力提升20%+等级×0.3%（100级：+50%防御）",
  skill: {
    id: "mmx_stomp",
    name: "踩踏",
    tags: [],
    cooldown: 9,
    castTime: 1,
    description: "110%攻击物理+自身防御×2纯粹（前排+20%）",
    damage: [
      { type: DamageType.Physical, atkRatio: 1.1 },
      { type: DamageType.Pure, selfDefMultiplier: 2 },
    ],
  },
};

// ======================== 猎人 ========================

const sszs: CharacterDef = {
  id: "sszs",
  name: "森之射手",
  race: Race.Hunter,
  stats: {
    hp: 7235,
    attack: 1070,
    physicalDef: 223,
    magicalDef: 198.2,
    attackInterval: 3.5,
  },
  growth: { hp: 65, attack: 10, physicalDef: 2, magicalDef: 1.8 },
  talent:
    "获得 20%+等级×0.05%的闪避效果（100级：25%）,如果同阵型还有其他友方猎人角色,闪避效果变为 30%+等级×0.1%（100级：40%）",
  skill: {
    id: "sszs_bind",
    name: "束缚射击",
    tags: ["控制"],
    cooldown: 6,
    castTime: 0,
    description: "攻击×210%物理+束缚2s",
    damage: [{ type: DamageType.Physical, atkRatio: 2.1 }],
    effects: [{ type: StatusType.Bind, duration: 2 }],
  },
};

const bslr: CharacterDef = {
  id: "bslr",
  name: "冰霜猎人",
  race: Race.Hunter,
  stats: {
    hp: 6740,
    attack: 1110.5,
    physicalDef: 218,
    magicalDef: 214,
    attackInterval: 3.2,
  },
  growth: { hp: 60, attack: 10.5, physicalDef: 2, magicalDef: 2 },
  talent:
    "自身造成伤害有 35%几率无视目标的基础防御,如果自身受到攻击这个效果会暂时失效 3 s",
  skill: {
    id: "bslr_shot",
    name: "持续射击",
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "对1排敌人持续射击3s，每秒攻击×90%，每次降6%攻速（叠3层）",
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
    hp: 8275,
    attack: 1005.5,
    physicalDef: 216,
    magicalDef: 213,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2, magicalDef: 2 },
  talent:
    "自身被 #切入 技能选中为目标时提升自身 50%+等级×0.4%的防御力与 25%+等级×0.1%的攻击力,持续 5 s(可叠加)",
  skill: {
    id: "hqs_snipe",
    name: "狙击",
    tags: [],
    cooldown: 10,
    castTime: 2.5,
    description: "物防最高敌人：物防×4纯粹+攻击×170%物理",
    damage: [
      { type: DamageType.Pure, defMultiplier: 4 },
      { type: DamageType.Physical, atkRatio: 1.7 },
    ],
  },
};

const mds: CharacterDef = {
  id: "mds",
  name: "美杜莎",
  race: Race.Hunter,
  stats: {
    hp: 8960,
    attack: 971,
    physicalDef: 250.7,
    magicalDef: 269.5,
    attackInterval: 2.8,
  },
  growth: { hp: 80, attack: 9, physicalDef: 2.3, magicalDef: 2.5 },
  talent:
    "自身攻击力-10%,会同时对 2 名敌人发动攻击,自身对处于[束缚]状态的敌人攻击有 35%+等级×0.1%几率使其[石化]2 s",
  skill: {
    id: "mds_skill",
    name: "石化凝视",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description: "前中后各1名敌人：攻击×140%魔法+束缚4s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.4 }],
    effects: [{ type: StatusType.Bind, duration: 4 }],
  },
};

const zfyx: CharacterDef = {
  id: "zfyx",
  name: "追风游侠",
  race: Race.Hunter,
  stats: {
    hp: 8175,
    attack: 1010.5,
    physicalDef: 269.5,
    magicalDef: 217,
    attackInterval: 2.5,
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "与该角色同阵型位置的所有敌方角色每次发动带有 #切入 标签的技能会对其造成 80% 伤害的攻击,并使我方同阵型所有角色提升 15% 攻击力持续 10 s（不叠加）",
  skill: {
    id: "zfyx_arrow",
    name: "三连射",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description: "发射3枚弓箭，每次攻击×110%随机敌人，发射后随机移动至空位",
    damage: [{ type: DamageType.Physical, atkRatio: 1.1 }],
    aoe: { maxTargets: 3 },
  },
};

const lxgz: CharacterDef = {
  id: "lxgz",
  name: "灵弦歌者",
  race: Race.Hunter,
  stats: {
    hp: 8720,
    attack: 857,
    physicalDef: 258.6,
    magicalDef: 237.8,
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 8, physicalDef: 2.4, magicalDef: 2.2 },
  talent:
    "自身发动治疗技能时,会使受治疗的目标获得 [激昂] 效果:提升 10%+等级×0.1%的攻击力与 15% 攻击速度,持续 5 秒。（100级：20%攻击提升）",
  skill: {
    id: "lxgz_heal",
    name: "治愈琴音",
    tags: ["治疗"],
    cooldown: 11,
    castTime: 2,
    description: "弹奏2s→最低2名友方持续恢复5s，每秒攻击×25%+已损生命×8%",
    heal: { atkRatio: 0.25, targetLostHpRatio: 0.08 },
    aoe: { maxTargets: 2 },
  },
};

// ======================== 战士 ========================

const crzs: CharacterDef = {
  id: "crzs",
  name: "炽热战士",
  race: Race.Warrior,
  stats: {
    hp: 8325,
    attack: 896.5,
    physicalDef: 287.5,
    magicalDef: 232,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "自身每秒失去最大生命值×1%的血量,受到伤害+10%，对敌方同阵型的所有敌方角色造成每秒自身攻击力×1.5%+等级×0.02%的纯粹伤害（100级：攻击力×3.5%）",
  skill: {
    id: "crzs_punch",
    name: "灼热拳击",
    tags: [],
    cooldown: 4,
    castTime: 0,
    description: "攻击×180%物理+灼烧3s，自受20%反伤",
    damage: [{ type: DamageType.Physical, atkRatio: 1.8 }],
    effects: [{ type: StatusType.Burn, duration: 3, value: 0.05 }],
  },
};

const hd: CharacterDef = {
  id: "hd",
  name: "辉刀",
  race: Race.Warrior,
  stats: {
    hp: 7780,
    attack: 956,
    physicalDef: 271.6,
    magicalDef: 210.2,
    attackInterval: 2.5,
  },
  growth: { hp: 70, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent: "自身攻击力+15%,命中率-15%,自身攻击如果没有命中,会受到 50%的反伤",
  skill: {
    id: "hd_slash",
    name: "斩击",
    tags: [],
    cooldown: 8,
    castTime: 1.5,
    description: "随机1排全体：攻击×200%物理",
    damage: [{ type: DamageType.Physical, atkRatio: 2.0 }],
    aoe: { maxTargets: 3 },
  },
};

const fxz: CharacterDef = {
  id: "fxz",
  name: "分析者",
  race: Race.Warrior,
  stats: {
    hp: 9315,
    attack: 693.5,
    physicalDef: 297.5,
    magicalDef: 297.5,
    attackInterval: 3.5,
  },
  growth: { hp: 85, attack: 6.5, physicalDef: 2.5, magicalDef: 2.5 },
  talent:
    "战斗开始标记敌人与自身对称的一名角色,被标记的角色闪避·额外防御变为0，直到分析者阵亡。",
  skill: {
    id: "fxz_analyze",
    name: "分析",
    tags: ["增益"],
    cooldown: 6,
    castTime: 0,
    description: "提升3名友方最低防御项5%防御力，可叠10次",
    scriptId: "fxz_analyze",
  },
};

const fdzs: CharacterDef = {
  id: "fdzs",
  name: "风之斗士",
  race: Race.Warrior,
  stats: {
    hp: 9760,
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
    cooldown: 8,
    castTime: 2,
    description: "2s内6次快速攻击，每次攻击×60%且无视基础防御",
    damage: [{ type: DamageType.Physical, atkRatio: 0.6 }],
    aoe: { maxTargets: 1 },
  },
};

const kzs: CharacterDef = {
  id: "kzs",
  name: "狂战士",
  race: Race.Warrior,
  stats: {
    hp: 6322,
    attack: 621.3,
    physicalDef: 184.4,
    magicalDef: 140.8,
    attackInterval: 2.0,
  },
  growth: { hp: 58, attack: 5.7, physicalDef: 1.6, magicalDef: 1.2 },
  talent:
    "自身每损失 12% 最大生命值,提升 4%+等级×0.08% 的攻击力,与6%伤害减免,最多叠加 5 层(即损失 60% 生命时达到最大)。",
  skill: {
    id: "kzs_rage",
    name: "血怒",
    tags: ["增益"],
    cooldown: 11,
    castTime: 0,
    description: "消耗10%当前HP→6s内攻速+40%，每次攻击附加目标当前HP×3%纯粹",
    effects: [{ type: StatusType.Bloodrage, duration: 6 }],
  },
};

const slzs: CharacterDef = {
  id: "slzs",
  name: "圣灵战士",
  race: Race.Warrior,
  stats: {
    hp: 9810,
    attack: 802.5,
    physicalDef: 228,
    magicalDef: 391.5,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7.5, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "每次受到魔法伤害有50%几率对施法者造成自身攻击力×60%+等级×0.25%的纯粹伤害,并使其[眩晕]1 s（100级：攻击力×85%）；有50%使那次魔法伤害-50%，并恢复自身周围随机1名友方角色剩余50%伤害的生命值。",
  skill: {
    id: "slzs_guard",
    name: "守护",
    tags: [],
    cooldown: 14,
    castTime: 0,
    description: "消耗10%HP→守护7s：攻-30%、减伤+25%、同排友方魔伤转移自身",
  },
};

const zqz: CharacterDef = {
  id: "zqz",
  name: "重拳者",
  race: Race.Warrior,
  stats: {
    hp: 6344,
    attack: 1139.5,
    physicalDef: 278.5,
    magicalDef: 208.2,
    attackInterval: 4.5,
  },
  growth: { hp: 56, attack: 10.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent: "自身每普通攻击 4 次,下次攻击附带 50%吸血与持续 6 s 的[破甲]效果",
  skill: {
    id: "zqz_strike",
    name: "毁灭打击",
    tags: ["切入"],
    cooldown: 10,
    castTime: 1,
    description: "攻击×290%物理+自晕2s+目标晕2s",
    damage: [{ type: DamageType.Physical, atkRatio: 2.9 }],
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
    "自身同排的所有友方角色每次发动技能提升自身 5%+等级×0.03%的攻击速度与4%技能吸血,持续 5 s(最大叠加 5 层)（100级：+8%攻击速度，4%技能吸血/层，满层：+40%攻击速度，20%技能吸血）",
  skill: {
    id: "xdds_fire",
    name: "火球",
    tags: [],
    cooldown: 7,
    castTime: 1.5,
    description: "攻击×210%魔法，每3次升级陨石(1排+攻击×260%+灼烧3s)",
    damage: [{ type: DamageType.Magical, atkRatio: 2.1 }],
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
  talent:
    "与自身前·后·左·右各 1 格的友方法师角色技能冷却减少 15%+等级×0.05%(对自身无效)",
  skill: {
    id: "sjsn_freeze",
    name: "冰封",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description: "1名敌方束缚+缴械+每秒攻击×90%魔法，持续3s",
    damage: [{ type: DamageType.Magical, atkRatio: 0.9 }],
    effects: [
      { type: StatusType.Bind, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
    ],
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
  talent:
    "友方全场法师每次对敌方施加异常状态,会使自身技能减少 1 s 冷却时间，并提升基础攻击力的0.8%的攻击力，直到战斗结束。",
  skill: {
    id: "bmxz_charge",
    name: "蓄力",
    tags: [],
    cooldown: 10,
    castTime: 0,
    description: "随机蓄力1/2/3s→前排/前中排/全场：攻击×190%魔法(命中5名-30%)",
    damage: [{ type: DamageType.Magical, atkRatio: 1.9 }],
    interruptOnAttack: true,
    aoe: { maxTargets: 9 },
    scriptId: "bmxz_charge",
  },
};

const srm: CharacterDef = {
  id: "srm",
  name: "食人魔魔法师",
  race: Race.Mage,
  stats: {
    hp: 11545,
    attack: 703.5,
    physicalDef: 348.8,
    magicalDef: 301.2,
    attackInterval: 3.2,
  },
  growth: { hp: 105, attack: 6.5, physicalDef: 3.2, magicalDef: 2.8 },
  talent: "友方阵亡→提升8%最大HP上限+恢复10%最大HP",
  skill: {
    id: "srm_fire",
    name: "火焰爆轰",
    tags: ["控制"],
    cooldown: 5,
    castTime: 0,
    description: "消耗5%HP→攻击×160%魔法+眩晕0.5s(40%2次/20%3次)",
    damage: [{ type: DamageType.Magical, atkRatio: 1.6 }],
    effects: [{ type: StatusType.Stun, duration: 0.5 }],
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
    "战斗开始 1 s 后,使与自身以及与自身对称的 1 名敌方角色暂时传送离开场地。经过 3 s 后自身会返回战斗场地,经过 4+等级 ×0.02 s （100级：6s）后那个敌方角色会返回战斗场地。",
  skill: {
    id: "ynfs_annihilate",
    name: "湮灭",
    tags: ["控制"],
    cooldown: 10,
    castTime: 2,
    description: "2×2格子：目标总防御²/350纯粹+束缚4s",
    damage: [{ type: DamageType.Pure, defSquaredDiv: 350 }],
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
    "自身每次攻击对我方随机 1 名友方角色提供攻击力×50%的治疗效果（80%几率对我方最低血量单位发动）自身阵亡时，为我方全场法师角色提供每秒攻击力×70%的治疗与15%伤害减免，持续6s（每秒后治疗效果、伤害减免+10%）",
  skill: {
    id: "syz_bless",
    name: "神之庇佑",
    tags: [],
    cooldown: 12,
    castTime: 0,
    description: "2名最低血量友方：减伤20%+延迟5s结算+驱散，持续7s",
    effects: [{ type: StatusType.Inspire, duration: 7, value: 0.8 }],
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
    cooldown: 7,
    castTime: 0,
    description: "随机移动→对1名敌人造成攻击×100%纯粹+周围格子诅咒3s",
    damage: [{ type: DamageType.Pure, atkRatio: 1.0 }],
    effects: [{ type: StatusType.Curse, duration: 3 }],
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
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "攻击×170%魔法+眩晕1s；3s后追加80%纯粹",
    damage: [
      { type: DamageType.Magical, atkRatio: 1.7 },
      { type: DamageType.Pure, atkRatio: 0.8 },
    ],
    effects: [{ type: StatusType.Stun, duration: 1 }],
  },
};

const klb: CharacterDef = {
  id: "klb",
  name: "骷髅兵",
  race: Race.Undead,
  stats: {
    hp: 1090,
    attack: 178.5,
    physicalDef: 109,
    magicalDef: 322,
    attackInterval: 3,
  },
  growth: { hp: 10, attack: 1.5, physicalDef: 1, magicalDef: 3 },
  talent: "优先攻击冥火之锤目标；无视40%防御；30%伤害治疗骷髅大帝",
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
    "每经过 8 s 使与自身同阵型的敌方所有角色陷入[诅咒]状态持续 5 s,复活后,该天赋升级为：与自身同阵型的敌方单位陷入[诅咒]与[破坏]状态",
  skill: {
    id: "yammxz_swap",
    name: "暗影换位",
    tags: ["移动"],
    cooldown: 7,
    castTime: 0,
    description: "与友方换位→对称2名敌人沉默4s+攻击×90%纯粹",
    damage: [{ type: DamageType.Pure, atkRatio: 0.9 }],
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
    "攻击与技能分别有25%几率与45%几率触发[致命一击],造成140%伤害,复活后,致命一击伤害变为180%。[致命一击]与暴击独立判定,若同时触发取伤害较高者。",
  skill: {
    id: "dyq_dash",
    name: "冲刺",
    tags: ["移动"],
    cooldown: 7,
    castTime: 0,
    description: "竖排全体攻击×170%魔法+30%灼烧4s（命中3人-30%）",
    damage: [{ type: DamageType.Magical, atkRatio: 1.7 }],
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
    cooldown: 8,
    castTime: 1,
    description: "前排最低血：每秒攻击×50%魔法，持续6s",
    damage: [{ type: DamageType.Magical, atkRatio: 0.5 }],
    aoe: { maxTargets: 1 },
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
    description: "后排全部：降20%攻速+每秒攻击×80%魔法3s；每3次→冰冻",
    damage: [{ type: DamageType.Magical, atkRatio: 0.8 }],
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
    description: "随机2排全体：攻击×190%物理+60%打乱位置",
    damage: [{ type: DamageType.Physical, atkRatio: 1.9 }],
    aoe: { maxTargets: 6 },
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
    cooldown: 12,
    castTime: 1,
    description: "冰封<50%HP龙族4s（免疫物理），每秒攻击×50%+最大HP×4%",
    heal: { atkRatio: 0.5, targetMaxHpRatio: 0.04 },
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
    "战斗开始，发出吼叫，使全场非龙族角色防御力降低 30%+等级×0.2%（100级：-50%防御），这个效果每 6 s 减少 15%，最低降至原本的 25%",
  skill: {
    id: "bjl_wing",
    name: "翅击",
    tags: ["切入"],
    cooldown: 9,
    castTime: 0,
    description: "中后排各1名：第1个180%物伤+30%降攻速4s，第2个230%物伤",
    damage: [
      { type: DamageType.Physical, atkRatio: 1.8 },
      { type: DamageType.Physical, atkRatio: 2.3 },
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
  talent: "自身攻击·技能各有35%/50%几率附加目标当前生命值×8%的魔法伤害",
  skill: {
    id: "zs_storm",
    name: "神之怒雷",
    tags: [],
    cooldown: 11,
    castTime: 2,
    description: "全屏攻击×150-180%魔法",
    damage: [
      { type: DamageType.Magical, atkRatio: 1.65, targetCurrentHpRatio: 0.08 },
    ],
    aoe: { maxTargets: 9 },
    interruptOnDamage: true,
  },
};

const xjl: CharacterDef = {
  id: "xjl",
  name: "小精灵",
  race: Race.Mage,
  stats: {
    hp: 11990,
    attack: 748,
    physicalDef: 322,
    magicalDef: 272.5,
    attackInterval: 4.5,
  },
  growth: { hp: 110, attack: 7, physicalDef: 3, magicalDef: 2.5 },
  talent:
    "我方全场单位每次发动技能对敌方造成伤害，自身恢复最大生命值×1%的血量（每2s最多通过该天赋恢复最大生命值×6%的血量）",
  skill: {
    id: "xjl_link",
    name: "链接",
    tags: [],
    cooldown: 11,
    castTime: 0,
    description: "链接1名友方8s：+30%技能增强+20%技能吸血，自身承担25%伤害",
    scriptId: "xjl_link",
  },
};

const swxz: CharacterDef = {
  id: "swxz",
  name: "死亡先知",
  race: Race.Undead,
  stats: {
    hp: 10850,
    attack: 797.5,
    physicalDef: 329,
    magicalDef: 358.8,
    attackInterval: 3.6,
  },
  growth: { hp: 100, attack: 7.5, physicalDef: 3, magicalDef: 3.2 },
  talent:
    "自身对处于[诅咒]状态敌人每累积造成700伤害，获得3%伤害减免直到战斗结束（最大叠加10层） （计算实际造成的伤害）",
  skill: {
    id: "swxz_drain",
    name: "吸魂巫术",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "吸取随机单位5s：每秒攻击×10%+最大HP×3%魔法，自身吸血20%。优先前排。被目标攻击中断。结束后诅咒4s",
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
    cooldown: 10,
    castTime: 2,
    description: "2×2随机格子：攻击×180%魔法+20%沉默/20%缴械3s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.8 }],
    aoe: { maxTargets: 4 },
    effects: [
      { type: StatusType.Silence, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
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
  talent:
    "（粗暴龙皮）普通攻击自身的敌方有50%几率会受到自身攻击×10%的纯粹伤害，有50%使那次伤害-40%",
  skill: {
    id: "dl_stomp",
    name: "龙踏",
    tags: ["控制"],
    cooldown: 10,
    castTime: 2,
    description: "全屏攻击×150%物理（前排140%/中排110%/后排80%）+降命中20%5s",
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
    tags: ["治疗"],
    cooldown: 11,
    castTime: 2,
    description:
      "最低HP龙族：每秒攻击×40%+20%减伤4s；4次后升级双目标70%+30%减伤；龙族阵亡时随机复活1只5s",
    heal: { atkRatio: 0.4 },
    scriptId: "lyz_heal",
  },
};

const xjlr: CharacterDef = {
  id: "xjlr",
  name: "陷阱猎人",
  race: Race.Hunter,
  stats: {
    hp: 8275,
    attack: 966,
    physicalDef: 237.8,
    magicalDef: 196.2,
    attackInterval: 3.5,
  },
  growth: { hp: 75, attack: 9, physicalDef: 2.2, magicalDef: 1.8 },
  talent:
    "战斗开始，在敌方场地随机2个格子放置[陷阱]，处于陷阱格子上的敌方单位无法使用 #移动 / #切入 标签的技能，同时每3s失去最大生命值×5%的血量。自身阵亡时，敌方场上全部陷阱清空。",
  skill: {
    id: "xjlr_trap",
    name: "超级陷阱",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description:
      "放1个超级陷阱：无法移动/切入，每2s攻击×80%+最大HP×2%纯粹，持续20s",
    scriptId: "xjlr_trap",
  },
};

const xblr: CharacterDef = {
  id: "xblr",
  name: "西部猎人",
  race: Race.Hunter,
  stats: {
    hp: 8442,
    attack: 1055,
    physicalDef: 248.7,
    magicalDef: 236.8,
    attackInterval: 2.8,
  },
  growth: { hp: 78, attack: 10, physicalDef: 2.3, magicalDef: 2.2 },
  talent:
    "每当我方场上其他猎人角色发动羁绊效果的[反击]时，自身也会对敌方随机1个目标发起1次攻击，这次攻击暴击率+40%",
  skill: {
    id: "xblr_shot",
    name: "跳跃射击",
    tags: ["移动"],
    cooldown: 10,
    castTime: 0,
    description: "跳至空位→1-3名敌人各3发：80%/90%/120%+第3发必暴击",
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
    attack: 758,
    physicalDef: 361.8,
    magicalDef: 337,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7, physicalDef: 3.2, magicalDef: 3 },
  talent:
    "（自然护盾）自身受到技能伤害时，有 40%+等级×0.1% 几率获得一个护盾，护盾值为自身攻击力×600%，持续 4 秒（冷却 5 秒）。护盾破碎时，使我方场上所有平分护盾值的恢复效果。",
  skill: {
    id: "ldshz_buff",
    name: "自然守护",
    tags: ["增益"],
    cooldown: 12,
    castTime: 0,
    description: "全队+20%双防+同排后排友方+20%暴击+30%吸血6s",
    scriptId: "ldshz_buff",
  },
};

const jdds: CharacterDef = {
  id: "jdds",
  name: "决斗大师",
  race: Race.Warrior,
  stats: {
    hp: 8325,
    attack: 812.5,
    physicalDef: 279.5,
    magicalDef: 208.2,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 7.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent:
    "自身每次击杀敌方单位受到自身当前攻击×30%的反冲伤害，那之后提升5%+等级×0.02%攻击力（100级：+7%攻击力）与3%防御力，直到战斗结束。",
  skill: {
    id: "jdds_steal",
    name: "战力夺舍",
    tags: [],
    cooldown: 6,
    castTime: 0,
    description: "夺取敌方攻最高角色20%攻击力5s",
    scriptId: "jdds_steal",
  },
};

// ===== v1.6.4 数值调整 =====

const wlgyz: CharacterDef = {
  id: "wlgyz",
  name: "亡灵歌咏者",
  race: Race.Undead,
  stats: {
    hp: 8275,
    attack: 634,
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
    cooldown: 11,
    castTime: 2,
    description: "恢复随机2名友方攻击×190%生命+诅咒随机1名敌方3s",
    heal: { atkRatio: 1.9 },
    aoe: { maxTargets: 2 },
    effects: [{ type: StatusType.Curse, duration: 3 }],
    interruptOnAttack: true,
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
  talent: "攻击处于异常状态的敌人获得15%吸血效果，复活后该天赋+100%",
  skill: {
    id: "mrsz_doom",
    name: "末日",
    tags: ["控制"],
    cooldown: 13,
    castTime: 0,
    description:
      "消耗20%HP→锁定近10s伤害最高目标：减疗50%+每秒13%atk纯粹+沉默+破坏，7s（HP<20%不可用）",
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
    "每经过 4 s 或者每当我方角色对敌方施加负面状态(每次施加动作仅增加 1 层,无论目标数量),自身都会获得 1 层 [魂能] 层数,最多叠加 5 层。每层 [魂能] 使自身攻击力·防御力提升 8%；复活后,立即获得 5 层 [魂能]。",
  skill: {
    id: "hyz_shield",
    name: "魂能护盾",
    tags: ["移动"],
    cooldown: 12,
    castTime: 0,
    description:
      "消耗全部魂能→瞬移最低HP亡灵旁+护盾(攻击×80%×层数)+驱散周围1格",
    effects: [{ type: StatusType.Shield, duration: 7 }],
  },
};

const aysl: CharacterDef = {
  id: "aysl",
  name: "暗影噬龙",
  race: Race.Dragon,
  stats: {
    hp: 8125,
    attack: 852,
    physicalDef: 197.2,
    magicalDef: 282.4,
    attackInterval: 3.5,
  },
  growth: { hp: 75, attack: 8, physicalDef: 1.8, magicalDef: 2.6 },
  talent:
    "自身对生命值低于 60% 的敌人造成伤害时，额外附加目标已损失生命值 × 5% 的纯粹伤害（最多不超过自身攻击力 × 60%）并使其[禁疗]4s",
  skill: {
    id: "aysl_strike",
    name: "暗影突袭",
    tags: ["切入"],
    cooldown: 10,
    castTime: 2,
    description:
      "蓄力2s→瞬移后排最低血目标：攻击×230%物理+暗影标记(受伤害+25%)4s；标记目标死亡→自回20%HP+全龙-20%CD",
    scriptId: "aysl_strike",
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
  ds,
  mmx,
  sszs,
  bslr,
  hqs,
  mds,
  zfyx,
  lxgz,
  xjlr,
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
  aysl,
];

export const CHARACTER_MAP = buildCharacterMap();

function buildCharacterMap(): Map<string, CharacterDef> {
  let overrides: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) overrides = JSON.parse(raw);
  } catch {}
  return new Map(
    ALL_CHARACTERS.map((c) => {
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
