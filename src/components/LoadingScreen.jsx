

import { Loader2 } from "lucide-react";

import { FONT_BODY } from "./theme.js";

export function LoadingScreen({t}) {
  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:12,fontFamily:FONT_BODY}}>
      <Loader2 size={22} className="bl-spin" color={t.accent}/>
      <div style={{fontSize:13,color:t.textMuted}}>Loading your data…</div>
    </div>
  );
}

