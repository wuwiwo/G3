import React from 'react';
import { CharacterDef } from '../types';
import CharacterInfoCard from './CharacterInfoCard';

interface Props { char: CharacterDef | null; onClose: () => void }

const CharDetail: React.FC<Props> = ({ char, onClose }) => {
  if (!char) return null;
  const s = char.stats;
  const pdr = Math.min(s.physicalDef/(s.physicalDef+200),0.8);
  const mdr = Math.min(s.magicalDef/(s.magicalDef+200),0.8);
  return (
    <CharacterInfoCard
      name={char.name}
      race={char.race}
      level={100}
      stats={[
        { label: '生命', value: String(s.hp) },
        { label: '攻击', value: String(s.attack) },
        { label: '物防', value: `${s.physicalDef}(${(pdr*100).toFixed(1)}%)` },
        { label: '魔防', value: `${s.magicalDef}(${(mdr*100).toFixed(1)}%)` },
        { label: '攻速', value: `${s.attackInterval}s` },
      ]}
      talent={char.talent}
      skillName={char.skill.name}
      skillDesc={char.skill.description}
      skillCD={char.skill.cooldown}
      skillCast={char.skill.castTime}
      onClose={onClose}
    />
  );
};

export default CharDetail;
