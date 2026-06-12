import React from 'react';
import { RACE_CONFIG } from '../data/races';

interface StatRow { label: string; value: string }

interface Props {
  name: string;
  race: string;
  level: number;
  stats: StatRow[];
  talent: string;
  skillName: string;
  skillDesc: string;
  skillCD: number;
  skillCast: number;
  onClose: () => void;
}

const CharacterInfoCard: React.FC<Props> = ({ name, race, level, stats, talent, skillName, skillDesc, skillCD, skillCast, onClose }) => {
  const cfg = RACE_CONFIG[race] || { color: '#999', label: '?' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', borderRadius: 12, padding: 20, maxWidth: '90%', width: 350,
        border: `2px solid ${cfg.color}`,
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          float: 'right', background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer',
        }}>✕</button>

        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{name}</div>
        <div style={{ fontSize: 13, color: cfg.color, fontWeight: 600, marginBottom: 10 }}>
          {cfg.label} · Lv.{level}
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 10,
          fontSize: 13, background: '#111', padding: 10, borderRadius: 8, border: '1px solid #2a2a2a',
        }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>{label}</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Talent */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#ff9800', fontWeight: 600, marginBottom: 3 }}>天赋</div>
          <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>{talent}</div>
        </div>

        {/* Skill */}
        <div>
          <div style={{ fontSize: 12, color: '#2196f3', fontWeight: 600, marginBottom: 3 }}>
            技能：{skillName}
            <span style={{ color: '#888', marginLeft: 8, fontWeight: 400, fontSize: 12 }}>
              CD {skillCD}s{skillCast > 0 ? ` · 施法${skillCast}s` : ' · 瞬发'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>{skillDesc}</div>
        </div>
      </div>
    </div>
  );
};

export default CharacterInfoCard;
