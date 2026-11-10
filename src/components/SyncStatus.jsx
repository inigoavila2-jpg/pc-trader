

import { Check, AlertTriangle, Loader2 } from "lucide-react";


export function SyncStatus({saveStatus,t,compact}) {
  const cfg=saveStatus==="saving"?{icon:Loader2,color:t.warning,label:"Saving…",spin:true}
    :saveStatus==="error"?{icon:AlertTriangle,color:t.negative,label:"Save failed",spin:false}
    :{icon:Check,color:t.positive,label:"Synced",spin:false};
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}} role="status" aria-live="polite">
      <cfg.icon size={12} color={cfg.color} className={cfg.spin?"bl-spin":undefined}/>
      {!compact&&<span style={{fontSize:10.5,fontWeight:600,color:cfg.color,whiteSpace:"nowrap"}}>{cfg.label}</span>}
    </div>
  );
}

