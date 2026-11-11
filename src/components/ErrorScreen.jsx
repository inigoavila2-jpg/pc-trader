

import { Check, AlertTriangle } from "lucide-react";

import { FONT_DISPLAY, FONT_BODY } from "./theme.js";

export function ErrorScreen({t}) {
  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.negative,display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:8,fontFamily:FONT_BODY,padding:24,textAlign:"center"}}>
      <AlertTriangle size={26}/>
      <div style={{fontSize:18,fontWeight:700,color:t.text,fontFamily:FONT_DISPLAY}}>Couldn't load your data</div>
      <div style={{fontSize:13,color:t.textMuted,maxWidth:360}}>Check that the server and database are reachable, then refresh.</div>
    </div>
  );
}

