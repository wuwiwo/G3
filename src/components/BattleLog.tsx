import React, { useRef, useEffect } from 'react';
import { BattleLogEntry } from '../types';

interface Props { entries: BattleLogEntry[] }

const TYPE_COLORS: Record<string,string> = {damage:'#f44336',heal:'#4caf50',status:'#ff9800',skill:'#2196f3',death:'#9c27b0',system:'#aaa'};

export const BattleLog: React.FC<Props> = ({ entries }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}) }, [entries.length]);

  return (
    <div style={{ height: 180, overflow: 'auto', background: '#111',
      border: '1px solid #333', borderRadius: 8, padding: 8,
      fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
    }}>
      {entries.map(e => (
        <div key={e.id} style={{ color: TYPE_COLORS[e.type] || '#ccc' }}>
          <span style={{ color: '#555' }}>[{e.time.toFixed(1)}s]</span>
          {' '}{e.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
export default BattleLog;
