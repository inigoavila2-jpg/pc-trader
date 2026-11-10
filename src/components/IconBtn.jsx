



import { useTheme } from "./theme.js";

export function IconBtn({icon:Icon,label,onClick,variant="ghost",size=36,iconSize=16,style={},...rest}){
  const t=useTheme();
  const VC={
    ghost:{bg:"transparent",txt:t.textMuted,hov:t.surfaceHover},
    surface:{bg:t.surfaceHover,txt:t.text,hov:t.borderStrong},
    danger:{bg:"transparent",txt:t.negative,hov:t.negativeSoft},
  };
  const c=VC[variant]||VC.ghost;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="bl-focusable"
      onMouseEnter={e=>e.currentTarget.style.background=c.hov} onMouseLeave={e=>e.currentTarget.style.background=c.bg}
      style={{width:size,height:size,borderRadius:9,border:"none",background:c.bg,color:c.txt,cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.12s",...style}} {...rest}>
      <Icon size={iconSize} strokeWidth={2.1}/>
    </button>
  );
}

/* ═══════════════════════════════════════════
   INPUT / SELECT
═══════════════════════════════════════════ */
