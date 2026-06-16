import { Equipment } from "../types";

export const ALL_EQUIPMENT: Equipment[] = [
  {
    id: "daedalus",
    name: "代达罗斯之殇",
    description: "攻击力+25%。攻击26%致命一击×175%（独立于暴击取高）",
    stats: { attackPercent: 25 },
    tags: ["fatal_strike"],
  },
  {
    id: "arcane_shield",
    name: "奥法护盾",
    description:
      "HP+10% 物防+10% 魔防+15%。开局攻击×300%护盾。每300魔伤充能1%，致命时减免等额伤害后破坏",
    stats: { hpPercent: 10, physicalDefPercent: 10, magicalDefPercent: 15 },
    tags: ["shield", "charge"],
  },
  {
    id: "heart",
    name: "恐鳌之心",
    description: "最大HP+30%。每秒回复最大HP×0.6%。异常状态时回复+50%",
    stats: { hpPercent: 30 },
    tags: ["regen"],
  },
  {
    id: "divine_rapier",
    name: "圣剑",
    description: "攻击力+44%。阵亡时转移给击杀者",
    stats: { attackPercent: 44 },
    tags: ["transfer_on_kill"],
  },
  {
    id: "desolator",
    name: "破败大剑",
    description: "攻击力+20%，攻击吸血25%。攻击30%使目标破甲5s",
    stats: { attackPercent: 20, lifeSteal: 25 },
    tags: ["armor_break"],
  },
  {
    id: "holy_locket",
    name: "圣灵护符",
    description: "HP+15% 攻击+5% 物防+8% 魔防+12%。治疗效果+25%",
    stats: {
      hpPercent: 15,
      attackPercent: 5,
      physicalDefPercent: 8,
      magicalDefPercent: 12,
    },
    tags: ["heal_boost"],
  },
  {
    id: "poison_blade",
    name: "淬毒之刃",
    description: "攻击速度+25%。造成伤害40%中毒5s。攻击中毒敌人伤害+20%",
    stats: {},
    tags: ["poison", "bonus_vs_poison"],
  },
  {
    id: "turban",
    name: "不屈头巾",
    description:
      "最大HP+15%。每次失去生命值提升4%攻击与6%防御5s(叠5层)。反冲伤害-50%",
    stats: { hpPercent: 15 },
    tags: ["rage"],
  },
  {
    id: "black_turban",
    name: "黑色头巾",
    description: "攻+12% 暴击+15% 命中+25% 最大HP-10%。每150HP→1攻击+0.7防御",
    stats: { attackPercent: 12, critRate: 15, hitRate: 25, hpPercent: -10 },
    tags: ["hp_convert"],
  },
  {
    id: "magic_adapter",
    name: "魔法调试器",
    description: "攻击转魔法伤害。物理伤害-45%，魔法伤害+16%",
    stats: {},
    tags: ["convert_magic"],
  },
  {
    id: "wave_suppressor",
    name: "波动抑制器",
    description: "全场治疗-40%。全场范围技能伤害-20%",
    stats: {},
    tags: ["global_heal_reduce", "global_aoe_reduce"],
  },
  {
    id: "formation_breaker",
    name: "阵型破坏器",
    description: "每13s，双方各4名角色随机打乱位置",
    stats: {},
    tags: ["shuffle"],
  },
  {
    id: "dragon_heart",
    name: "龙之心脏",
    description: "技能起始冷却-50%。首个技能伤害+50%，之后破坏",
    stats: {},
    tags: ["cd_reduce", "first_skill_boost"],
  },
  {
    id: "bone_gnaw",
    name: "碎骨弩",
    description: "攻击力+20%。攻击无视35%基础防御",
    stats: { attackPercent: 20 },
    tags: ["ignore_def"],
  },
  {
    id: "battle_aid",
    name: "战斗互助器",
    description: "相邻友方+10%攻击+15%防御。自身HP<50%时破坏",
    stats: {},
    tags: ["adjacent_buff"],
  },
  {
    id: "victory_horn",
    name: "胜利号角",
    description: "我方存活>敌方时：全队+10%攻击+15%攻速",
    stats: {},
    tags: ["advantage_buff"],
  },
  {
    id: "cursed_tome",
    name: "诅咒之书",
    description: "伤害-10% 治疗-25%。诅咒时每秒-2%HP。被击杀后转移给击杀者",
    stats: {},
    tags: ["curse_transfer"],
  },
  {
    id: "demon_slayer",
    name: "斩魔剑",
    description:
      "魔法伤害-50%。受魔法伤害→+3%攻击+3%魔防7s。攻击40%降敌技能伤害-40%4s",
    stats: {},
    tags: ["anti_mage"],
  },
  {
    id: "hard_helm",
    name: "坚硬头盔",
    description: "HP+15% 物防+45%。受物理伤害反弹20%原始伤害",
    stats: { hpPercent: 15, physicalDefPercent: 45 },
    tags: ["thorns"],
  },
  {
    id: "attention_hat",
    name: "瞩目头饰",
    description:
      "受到攻击几率+50%。HP<60%时触发：其他友方恢复自身失去HP×10%。之后破坏",
    stats: {},
    tags: ["taunt", "sacrifice"],
  },
  {
    id: "dwarf_goggles",
    name: "缩小护镜",
    description: "闪避率+15%。受到攻击几率-35%。战斗开始15s后破坏",
    stats: {},
    tags: ["evasion", "expire"],
  },
  {
    id: "golden_staff",
    name: "金箍棒",
    description: "命中率+50% 攻击速度+20%。攻击40%附加自身攻击×20%魔法伤害",
    stats: {},
    tags: ["bonus_magic_dmg"],
  },
];

export const EQUIPMENT_MAP = new Map(ALL_EQUIPMENT.map((e) => [e.id, e]));
