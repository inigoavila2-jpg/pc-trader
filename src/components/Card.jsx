



import { useTheme } from "./theme.js";

export function Card({children,style={},as:As="div",...rest}) {
  const t=useTheme();
  return <As style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:18,boxShadow:t.shadowSm,...style}} {...rest}>{children}</As>;
}

/* ═══════════════════════════════════════════
   BUTTON — six variants, all theme-aware. Solid fills (primary/success) use a
   deep shade with white text verified at 5:1+; soft variants (ghost/info/warn/
   danger) tint the base surface so destructive/secondary actions read as one
   step down in emphasis rather than shouting as loud as the primary action.
═══════════════════════════════════════════ */
