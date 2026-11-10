import { useState, useEffect, useRef } from "react";



import { usePrefersReducedMotion } from "../hooks/appHooks.js";

export function AnimNum({value}) {
  const reduceMotion=usePrefersReducedMotion();
  const [d,setD]=useState(reduceMotion?value:0);
  const prev=useRef(reduceMotion?value:0);
  useEffect(()=>{
    if(reduceMotion){setD(value);prev.current=value;return;}
    const start=prev.current,end=value,diff=end-start;
    if(!diff)return;
    let i=0;const steps=20;
    const tmr=setInterval(()=>{i++;setD(Math.round(start+(diff*i)/steps));if(i>=steps){clearInterval(tmr);prev.current=end;}},16);
    return()=>clearInterval(tmr);
  },[value,reduceMotion]);
  return <>{d.toLocaleString("en-PH")}</>;
}

/* ═══════════════════════════════════════════
   STATUS BADGE — status color now maps through the theme's four-hue semantic
   system (positive/info/neutral/negative) instead of one-off hex values, so it
   stays correct in both themes automatically.
═══════════════════════════════════════════ */
