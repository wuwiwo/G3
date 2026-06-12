import React from 'react';
import { ArenaUnit } from '../types';
import CharacterInfoCard from './CharacterInfoCard';

interface Props { unit: ArenaUnit | null; onClose: () => void }

const UnitDetail: React.FC<Props> = ({ unit, onClose }) => {
  if (!unit) return null;
  const u = unit;
  return (
    <CharacterInfoCard
      name={u.def.name}
      race={u.def.race}
      level={u.level}
      stats={[
        { label: '生命', value: `${Math.floor(u.currentHp)} / ${u.maxHp}` },
        { label: '攻击', value: String(Math.floor(u.currentAttack)) },
        { label: '物防', value: String(Math.floor(u.currentPhysicalDef)) },
        { label: '魔防', value: String(Math.floor(u.currentMagicalDef)) },
        { label: '攻速', value: `${u.def.stats.attackInterval}s` },
      ]}
      talent={u.def.talent}
      skillName={u.def.skill.name}
      skillDesc={u.def.skill.description}
      skillCD={u.def.skill.cooldown}
      skillCast={u.def.skill.castTime}
      onClose={onClose}
    />
  );
};

export default UnitDetail;
