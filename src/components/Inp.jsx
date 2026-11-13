import { useState } from "react";

import { CircleAlert } from "lucide-react";

import { FONT_BODY, useTheme } from "./theme.js";

export function Inp({label,error,icon:Icon,style,...props}) {
  const t=useTheme();
  const [f,setF]=useState(false);
  const handleChange=props.type==="number"&&props.onChange
    ? (e)=>{
        if(e.target.value.startsWith("-")){e.target.value=e.target.value.replace(/^-+/,"");}
        props.onChange(e);
      }
    : props.onChange;
  return (
    <label style={{display:"flex",flexDirection:"column",gap:6,fontSize:13.5,color:t.textMuted,fontFamily:FONT_BODY,fontWeight:600}}>
      {label}
      <span style={{position:"relative",display:"block"}}>
        {Icon&&<Icon size={15} strokeWidth={2} aria-hidden="true" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:t.textFaint,pointerEvents:"none"}}/>}
        <input {...props} onChange={handleChange} min={props.type==="number"?(props.min??0):props.min}
          onFocus={e=>{setF(true);props.onFocus?.(e);}} onBlur={e=>{setF(false);props.onBlur?.(e);}}
          style={{background:t.surfaceSunken,border:`1px solid ${error?t.negative:f?t.accent:t.border}`,borderRadius:9,
            padding:Icon?"10px 12px 10px 34px":"10px 12px",color:t.text,fontSize:16,outline:"none",fontFamily:FONT_BODY,
            boxShadow:f?`0 0 0 3px ${t.focusRing}`:"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",minHeight:44,...(style||{})}} />
      </span>
      {error&&<span style={{color:t.negative,fontSize:12,display:"flex",alignItems:"center",gap:4}}><CircleAlert size={13}/>{error}</span>}
    </label>
  );
}

