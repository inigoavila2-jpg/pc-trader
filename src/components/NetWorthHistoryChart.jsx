


import { fmt } from "../data/model.js";
import { FONT_MONO, useTheme } from "./theme.js";

export function NetWorthHistoryChart({rows}) {
  const t=useTheme();
  if(!rows?.length)return null;
  if(rows.length===1){
    return <div style={{fontFamily:FONT_MONO,fontSize:17,fontWeight:700,color:t.text,padding:"16px 0 8px"}}>{fmt(rows[0].value)}</div>;
  }
  const values=rows.map(r=>Number(r.value||0));
  const min=Math.min(...values),max=Math.max(...values);
  const span=Math.max(1,max-min);
  const toXY=(v,i)=>{
    const x=(i/(rows.length-1))*100;
    const y=33-((v-min)/span)*27;
    return [x,y];
  };
  const path=rows.map((r,i)=>{const [x,y]=toXY(r.value,i);return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;}).join(" ");
  const [fx]=toXY(values[0],0),[lx]=toXY(values[values.length-1],values.length-1);
  const area=`M${fx},33 ${path.replace(/^M/,"L")} L${lx},33 Z`;
  const trend=values[values.length-1]-values[0];
  const color=trend>=0?t.positive:t.negative;
  const gid=`nwh-${t.mode}`;
  return (
    <div>
      <svg viewBox="0 0 100 42" style={{width:"100%",height:112,display:"block"}} preserveAspectRatio="none" role="img" aria-label="Net worth history chart">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.24"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        {[7,14,21,28,35].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} stroke={t.border} strokeWidth="0.4"/>)}
        <path d={area} fill={`url(#${gid})`} stroke="none"/>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        {rows.map((r,i)=>{const [x,y]=toXY(r.value,i);return <circle key={r.key} cx={x} cy={y} r="1.6" fill={color}/>;})}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:4}}>
        {rows.map(r=><div key={r.key} style={{fontSize:9.5,color:t.textFaint,textAlign:"center",flex:1,whiteSpace:"nowrap"}}>{r.label}</div>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
        <span style={{fontSize:11,color:t.textFaint}}>First → latest saved value</span>
        <span style={{fontSize:12,fontFamily:FONT_MONO,fontWeight:700,color}}>{trend>=0?"+":"−"}{fmt(Math.abs(trend))}</span>
      </div>
    </div>
  );
}

