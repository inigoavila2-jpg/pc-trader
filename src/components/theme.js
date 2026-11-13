import { createContext, useContext } from "react";

import { User } from "lucide-react";


export const THEME = {
  dark: {
    mode:"dark",
    bg:"#0E0E0F", bgElevated:"#171615",
    surface:"#171615", surfaceSunken:"#0A0A0A", surfaceHover:"#201F1D",
    border:"#2C2A26", borderStrong:"#3D3A34",
    text:"#F2F0EC", textMuted:"#A8A296", textFaint:"#7A7568",
    accent:"#E8A33D", accentStrong:"#B8791F", accentContrast:"#181206", accentSoft:"rgba(232,163,61,0.14)", accentSoftBorder:"rgba(232,163,61,0.4)",
    info:"#5FAFC9", infoStrong:"#227087", infoSoft:"rgba(95,175,201,0.13)", infoSoftBorder:"rgba(95,175,201,0.36)",
    positive:"#3FC088", positiveStrong:"#167A4D", positiveSoft:"rgba(63,192,136,0.13)", positiveSoftBorder:"rgba(63,192,136,0.36)",
    negative:"#F0716F", negativeStrong:"#C33F3D", negativeSoft:"rgba(240,113,111,0.13)", negativeSoftBorder:"rgba(240,113,111,0.36)",
    warning:"#D8813F", warningSoft:"rgba(216,129,63,0.13)", warningSoftBorder:"rgba(216,129,63,0.36)",
    overlay:"rgba(5,5,5,0.75)", focusRing:"rgba(232,163,61,0.45)",
    shadow:"0 12px 32px rgba(0,0,0,0.5)", shadowSm:"0 2px 10px rgba(0,0,0,0.4)",
  },
  light: {
    mode:"light",
    bg:"#F4F6F8", bgElevated:"#FFFFFF",
    surface:"#FFFFFF", surfaceSunken:"#F1F3F5", surfaceHover:"#E9EDF2",
    border:"#DCE2E8", borderStrong:"#BBC5D0",
    text:"#18212B", textMuted:"#4B5867", textFaint:"#596777",
    accent:"#A65B0A", accentStrong:"#854D0E", accentContrast:"#FFFFFF", accentSoft:"rgba(166,91,10,0.09)", accentSoftBorder:"rgba(166,91,10,0.3)",
    info:"#35566B", infoStrong:"#294453", infoSoft:"rgba(53,86,107,0.08)", infoSoftBorder:"rgba(53,86,107,0.28)",
    positive:"#1F7A4D", positiveStrong:"#17603C", positiveSoft:"rgba(31,122,77,0.08)", positiveSoftBorder:"rgba(31,122,77,0.28)",
    negative:"#B12B28", negativeStrong:"#8F211F", negativeSoft:"rgba(177,43,40,0.08)", negativeSoftBorder:"rgba(177,43,40,0.3)",
    warning:"#8C6A1F", warningSoft:"rgba(140,106,31,0.08)", warningSoftBorder:"rgba(140,106,31,0.28)",
    overlay:"rgba(20,16,10,0.5)", focusRing:"rgba(0,0,0,0.35)",
    shadow:"0 12px 32px rgba(40,30,10,0.14)", shadowSm:"0 2px 10px rgba(40,30,10,0.09)",
  },
};

// User-editable color tokens. Colors are persisted in localStorage and applied on top
// of the selected base theme; soft fills/focus rings are derived automatically.

export const THEME_COLOR_FIELDS = [
  { key:"bg", label:"Main Background", group:"Surfaces" },
  { key:"bgElevated", label:"Elevated Background", group:"Surfaces" },
  { key:"surface", label:"Surface / Cards", group:"Surfaces" },
  { key:"surfaceSunken", label:"Sunken Surface / Inputs", group:"Surfaces" },
  { key:"surfaceHover", label:"Hover Surface", group:"Surfaces" },
  { key:"border", label:"Border", group:"Surfaces" },
  { key:"borderStrong", label:"Strong Border", group:"Surfaces" },
  { key:"text", label:"Primary Text", group:"Text" },
  { key:"textMuted", label:"Muted Text", group:"Text" },
  { key:"textFaint", label:"Faint Text", group:"Text" },
  { key:"accent", label:"Main Accent", group:"Accents & Status" },
  { key:"accentStrong", label:"Strong Accent", group:"Accents & Status" },
  { key:"accentContrast", label:"Text on Accent", group:"Accents & Status" },
  { key:"positive", label:"Positive / Profit", group:"Accents & Status" },
  { key:"positiveStrong", label:"Strong Positive", group:"Accents & Status" },
  { key:"info", label:"Information", group:"Accents & Status" },
  { key:"infoStrong", label:"Strong Information", group:"Accents & Status" },
  { key:"negative", label:"Negative / Loss", group:"Accents & Status" },
  { key:"negativeStrong", label:"Strong Negative", group:"Accents & Status" },
  { key:"warning", label:"Warning", group:"Accents & Status" },
];


export function normalizeHex(value) {
  const raw=String(value||"").trim();
  const withHash=raw.startsWith("#")?raw:`#${raw}`;
  if(/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  if(/^#[0-9a-fA-F]{3}$/.test(withHash)) return `#${withHash.slice(1).split("").map(c=>c+c).join("")}`.toUpperCase();
  return null;
}


export function hexToRgba(hex, alpha) {
  const normalized=normalizeHex(hex);
  if(!normalized) return `rgba(232,163,61,${alpha})`;
  const n=parseInt(normalized.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
}


export function buildTheme(base, overrides={}) {
  const valid={};
  for(const field of THEME_COLOR_FIELDS){
    const candidate=overrides?.[field.key];
    const normalized=normalizeHex(candidate);
    if(normalized) valid[field.key]=normalized;
  }
  const t={...base,...valid};
  t.accentSoft=hexToRgba(t.accent,0.14);
  t.accentSoftBorder=hexToRgba(t.accent,0.4);
  t.infoSoft=hexToRgba(t.info,0.13);
  t.infoSoftBorder=hexToRgba(t.info,0.36);
  t.positiveSoft=hexToRgba(t.positive,0.13);
  t.positiveSoftBorder=hexToRgba(t.positive,0.36);
  t.negativeSoft=hexToRgba(t.negative,0.13);
  t.negativeSoftBorder=hexToRgba(t.negative,0.36);
  t.warningSoft=hexToRgba(t.warning,0.13);
  t.warningSoftBorder=hexToRgba(t.warning,0.36);
  t.focusRing=hexToRgba(t.accent,0.45);
  return t;
}

export const STATUS_TONE = { available:"positive", in_build:"info", sold:"neutral", defective:"negative" };

// Font stacks — Space Grotesk (headings/hero numbers), Inter (UI/body), IBM Plex Mono (money/ledger figures)

export const FONT_DISPLAY = "'Space Grotesk',ui-sans-serif,system-ui,sans-serif";

export const FONT_BODY = "'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif";

export const FONT_MONO = "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace";

export const GOOGLE_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap";


export const ThemeCtx = createContext(THEME.dark);

export const useTheme = () => useContext(ThemeCtx);

/* Breakpoint hook — the redesign's responsive shell (sidebar at desktop widths,
   refined top tabs below that) hangs off this single source of truth. */
