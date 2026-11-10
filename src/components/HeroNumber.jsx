



import { FONT_MONO, useTheme } from "./theme.js";

export function HeroNumber({children,color}) {
  const t=useTheme();
  // Solid theme-aware text avoids the gradient-clip rendering bug on some browsers.
  return (
    <span style={{
      display:"inline-block",
      background:"none",
      WebkitBackgroundClip:"initial",
      backgroundClip:"initial",
      color:color||t.text,
      fontFamily:FONT_MONO, fontWeight:700, letterSpacing:"-0.02em",
    }}>{children}</span>
  );
}

