import { Fragment } from "react";


import { fmt } from "../data/model.js";
import { FONT_MONO, useTheme } from "./theme.js";
import { Inventory } from "../pages/Inventory.jsx";

export function CapitalFlowDiagram({invested,inventoryVal,recovered,profit}) {
  const t=useTheme();
  const stages=[
    {label:"Cash in",sub:"capital deployed",value:invested,color:t.info},
    {label:"Inventory",sub:"held at market value",value:inventoryVal,color:t.accent},
    {label:"Sales",sub:"revenue collected",value:recovered,color:t.positive},
    {label:"Profit",sub:profit>=0?"net gain":"net loss",value:profit,color:profit>=0?t.positive:t.negative},
  ];
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto",paddingBottom:4}}>
      {stages.map((s,i)=>(
        <Fragment key={s.label}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:92,flexShrink:0}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:s.color,boxShadow:`0 0 0 3px ${s.color}22`}}/>
            <div style={{fontSize:14,fontWeight:700,fontFamily:FONT_MONO,color:t.text}}>{fmt(s.value)}</div>
            <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600,textAlign:"center"}}>{s.label}</div>
            <div style={{fontSize:9.5,color:t.textFaint,textAlign:"center"}}>{s.sub}</div>
          </div>
          {i<stages.length-1&&(
            <svg width="36" height="10" style={{flexShrink:0,margin:"0 2px 28px"}} aria-hidden="true">
              <line x1="0" y1="5" x2="30" y2="5" stroke={t.border} strokeWidth="1.5"/>
              <polygon points="30,1 36,5 30,9" fill={t.border}/>
            </svg>
          )}
        </Fragment>
      ))}
    </div>
  );
}

