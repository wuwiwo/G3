import React, { useState, useEffect } from 'react';
import { Row, Race, RACE_NAMES, CharacterDef } from '../types';
import { ALL_CHARACTERS, CHARACTER_MAP } from '../data/characters';
import CharDetail from './CharDetail';
import { useSavedTeams } from '../hooks/useSavedTeams';
import { calcBondsFromDefs } from '../engine/bonds';

const RACE_ORDER: Race[] = ['beast','hunter','warrior','mage','undead','dragon'] as any;
const RC: Record<string,string> = {beast:'#8d6e63',hunter:'#4caf50',warrior:'#f44336',mage:'#2196f3',undead:'#9c27b0',dragon:'#ff9800'};
const RL: Record<string,string> = {beast:'兽族',hunter:'猎人',warrior:'战士',mage:'法师',undead:'亡灵',dragon:'龙族'};
const ROW_LABELS = ['前排','中排','后排'];
const sbtn: React.CSSProperties = {padding:'1px 6px',fontSize:9,background:'#333',color:'#aaa',border:'none',borderRadius:2,cursor:'pointer'};

export interface SlotInfo { charId:string; row:Row; col:number; }
function posRC(i:number):{row:Row;col:number} { return {row:Math.floor(i/3)as Row,col:i%3}; }

/** Compute active bonds from a grid */
function getActiveBonds(grid:{charId:string|null}[]):{race:string;count:number;desc:string}[] {
  return calcBondsFromDefs(grid);
}

function TeamPanel({side,label,color,onChange}:{
  side:'ally'|'enemy';label:string;color:string;
  onChange?:(data:SlotInfo[])=>void;
}) {
  const {teams,saveTeam,deleteTeam} = useSavedTeams();
  const [grid,setGrid] = useState<{charId:string|null}[]>(Array.from({length:9},()=>({charId:null})));
  const [sel,setSel] = useState<string|null>(null);
  const [detail,setDetail] = useState<CharacterDef|null>(null);
  const [pool,setPool] = useState(true);
  const [exp,setExp] = useState<Record<string,boolean>>({beast:true,hunter:true,warrior:true,mage:true,undead:true,dragon:true});
  const [sname,setSname] = useState('');

  const placed = grid.filter(s=>s.charId).length;
  const bonds = calcBondsFromDefs(grid);

  const emit = (g:{charId:string|null}[]) => {
    const data = g.map((s,i)=>{const rc=posRC(i);return{charId:s.charId||'',row:rc.row,col:rc.col}}).filter(s=>s.charId);
    if(onChange) onChange(data as SlotInfo[]);
  };

  const clickGrid = (i:number) => {
    if(!sel) return;
    const ng = grid.map(s=>({...s}));
    const ex = ng.findIndex(s=>s.charId===sel);
    if(ex>=0) ng[ex]={charId:null};
    if(ng[i].charId===null||placed<8) ng[i]={charId:sel};
    setGrid(ng); setSel(null); emit(ng);
  };

  const remove = (i:number) => { const ng=grid.map(s=>({...s})); ng[i]={charId:null}; setGrid(ng); emit(ng); };
  const randomize = () => {
    const p=[...ALL_CHARACTERS].sort(()=>Math.random()-0.5);
    const ng=Array.from({length:9},(_,i)=>i===8?{charId:null}:{charId:p[i%p.length].id});
    setGrid(ng); emit(ng);
  };
  const clear = () => { const ng=Array.from({length:9},()=>({charId:null})); setGrid(ng); emit(ng); };
  const load = (t:any) => {
    const ng=Array.from({length:9},()=>({charId:null}));
    ((t?.units||t||[]).slice(0,9)).forEach((u:any,i:number)=>{if(u.charId)ng[i]={charId:u.charId}});
    setGrid(ng); emit(ng);
  };
  useEffect(()=>{emit(grid)},[]);

  const raceRows = RACE_ORDER.map(r => ({race:r, chars:ALL_CHARACTERS.filter(c=>c.race===r), open:exp[r]}));

  return (
    <div style={{marginBottom:8}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
        <span style={{fontSize:14,fontWeight:700,color}}>{label} {placed}/8</span>
        <div style={{display:'flex',gap:3}}>
          <button onClick={()=>setPool(!pool)} style={sbtn}>{pool?'🔼':'🔽'}角色</button>
          <button onClick={clear} style={sbtn}>清空</button>
          <button onClick={randomize} style={sbtn}>🎲随机</button>
        </div>
      </div>

      {/* Active bonds display */}
      {bonds.length>0 && (
        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:3}}>
          {bonds.map(b => (
            <span key={b.race} style={{
              fontSize:9,padding:'2px 6px',borderRadius:3,
              background:RC[b.race]||'#555',color:'#000',fontWeight:700,
            }}>
              {RL[b.race]}×{b.count} 🌟 {b.desc}
            </span>
          ))}
        </div>
      )}

      {/* 3×3 grid */}
      <div style={{display:'grid',gridTemplateColumns:'24px 1fr',gap:2,marginBottom:4,background:'#1a1a2e',padding:4,borderRadius:6,border:'1px solid #333'}}>
        <div style={{display:'contents'}}>
          {[0,1,2].map(r => <div key={r} style={{fontSize:9,color:'#555',display:'flex',alignItems:'center',justifyContent:'center'}}>{ROW_LABELS[r]}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
          {grid.map((slot,i) => {
            const ch = slot.charId ? CHARACTER_MAP.get(slot.charId) || null : null;
            const bg = ch ? RC[ch.race]||color : '#333';
            return (
              <div key={i} onClick={()=>clickGrid(i)} onContextMenu={e=>{e.preventDefault();remove(i)}}
                style={{height:40,borderRadius:4,background:ch?'#2a2a3e':'#0d0d1a',border:`2px solid ${ch?bg:'#222'}`,
                  cursor:sel?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {ch ? <span style={{fontSize:10,fontWeight:700,color:'#fff'}}>{ch.name}</span>
                  : <span style={{fontSize:8,color:'#333'}}>空</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pool */}
      {pool && (
        <div style={{display:'flex',gap:2,flexWrap:'wrap',marginBottom:3}}>
          {raceRows.map(rr => (
            <div key={rr.race}>
              <div onClick={()=>setExp(e=>({...e,[rr.race]:!e[rr.race]}))}
                style={{fontSize:9,fontWeight:700,color:RC[rr.race]||'#888',padding:'1px 4px',cursor:'pointer'}}>
                {RL[rr.race]} {rr.open?'▲':'▼'}
              </div>
              {rr.open && (
                <div style={{display:'flex',gap:1,flexWrap:'wrap',padding:'1px 0 2px 3px'}}>
                  {rr.chars.map(ch => (
                    <div key={ch.id} style={{display:'flex',gap:1}}>
                      <div onClick={()=>setSel(ch.id)}
                        style={{padding:'2px 5px',fontSize:9,whiteSpace:'nowrap',
                          background:sel===ch.id?'#4caf50':'#1a1a2e',
                          border:`1px solid ${sel===ch.id?'#4caf50':'#444'}`,
                          borderRadius:'3px 0 0 3px',color:sel===ch.id?'#000':'#ccc',cursor:'pointer'}}>{ch.name}</div>
                      <div onClick={()=>setDetail(ch)}
                        style={{padding:'2px 5px',fontSize:9,background:'#222',border:'1px solid #444',borderLeft:'none',borderRadius:'0 3px 3px 0',color:'#888',cursor:'pointer'}}>👁</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save / Load / Delete - shared pool */}
      <div style={{display:'flex',gap:3,alignItems:'center',flexWrap:'wrap'}}>
        <input value={sname} onChange={e=>setSname(e.target.value)} placeholder="阵容名"
          style={{width:60,fontSize:9,padding:'1px 4px',background:'#222',border:'1px solid #444',color:'#fff',borderRadius:2}}/>
        <button onClick={()=>{if(sname){const d=grid.map((s,i)=>{const rc=posRC(i);return{charId:s.charId||'',row:rc.row,col:rc.col}}).filter(s=>s.charId);saveTeam(sname,d as any);setSname('')}}}
          style={{padding:'1px 5px',fontSize:9,background:'#4caf50',color:'#000',border:'none',borderRadius:2,cursor:'pointer'}}>💾</button>

        {/* All saved teams (shared) */}
        {teams.length>0 && (
          <select onChange={e=>{
            const idx=Number(e.target.value);
            if(idx>=0){const t=teams[idx];if(t)load(t);}
          }} style={{fontSize:9,padding:'1px 3px',background:'#222',color:'#ccc',border:'1px solid #444',borderRadius:2,maxWidth:100}}>
            <option value="">📂读取</option>
            {teams.map((t,i)=><option key={t.id} value={i}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Tip */}
      <div style={{fontSize:8,color:'#444',marginTop:2,display:'flex',justifyContent:'space-between'}}>
        <span>点击名→格子 · 右键移除 · 留1空</span>
      </div>
      {detail && <CharDetail char={detail} onClose={()=>setDetail(null)}/>}
    </div>
  );
}

export const TeamSetup: React.FC<{onStart:(ally:SlotInfo[],enemy:SlotInfo[])=>void}> = ({onStart}) => {
  const [ally,setAlly] = useState<SlotInfo[]>([]);
  const [enemy,setEnemy] = useState<SlotInfo[]>([]);
  const {teams,deleteTeam} = useSavedTeams();
  const [delMode,setDelMode] = useState(false);
  const ready = ally.length>0 && enemy.length>0;

  return (
    <div style={{padding:'6px 8px 30px',maxWidth:600,margin:'0 auto'}}>
      <div style={{position:'sticky',top:0,zIndex:20,background:'#0d0d1a',padding:'4px 0',
        display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #222',marginBottom:4}}>
        <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>阵容配置</span>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button onClick={()=>setDelMode(!delMode)}
            style={{padding:'2px 8px',fontSize:9,background:'#f44336',color:'#fff',border:'none',borderRadius:3,cursor:'pointer'}}>
            {delMode?'完成':'🗑️删存档'}
          </button>
          <button onClick={()=>onStart(ally,enemy)} disabled={!ready}
            style={{padding:'6px 16px',fontSize:13,fontWeight:700,border:'none',borderRadius:6,
              background:ready?'#4caf50':'#333',color:ready?'#000':'#666',cursor:ready?'pointer':'not-allowed'}}>
            开始 ⚔️
          </button>
        </div>
      </div>

      {/* Delete mode: show all teams with delete buttons */}
      {delMode && teams.length>0 && (
        <div style={{background:'#1a1a2e',border:'1px solid #f44336',borderRadius:6,padding:8,marginBottom:6}}>
          <div style={{fontSize:10,color:'#f44336',marginBottom:4}}>点击删除存档：</div>
          {teams.map(t => (
            <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 0',borderBottom:'1px solid #222'}}>
              <span style={{fontSize:11,color:'#ccc'}}>{t.name}</span>
              <button onClick={()=>deleteTeam(t.id)}
                style={{padding:'1px 8px',fontSize:9,background:'#f44336',color:'#fff',border:'none',borderRadius:3,cursor:'pointer'}}>删除</button>
            </div>
          ))}
        </div>
      )}

      <TeamPanel side="ally" label="🟦 我方" color="#4fc3f7" onChange={setAlly} />
      <div style={{textAlign:'center',fontSize:12,color:'#444',padding:'1px 0'}}>⚔</div>
      <TeamPanel side="enemy" label="🟥 敌方" color="#ef5350" onChange={setEnemy} />
      {!ready && <div style={{textAlign:'center',color:'#555',fontSize:10,marginTop:6}}>配置双方阵容即可开战</div>}
    </div>
  );
};
