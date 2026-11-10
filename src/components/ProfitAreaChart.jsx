



import { useTheme } from "./theme.js";

export function ProfitAreaChart({points,positive}) {
  const t=useTheme();
  if(points.length<2)return null;
  const max=Math.max(1,...points.map(Math.abs));
  const toXY=(v,i)=>{
    const x=(i/(points.length-1))*100;
    const y=32-(v/max)*28;
    return [x,y];
  };
  const linePath=points.map((v,i)=>{const [x,y]=toXY(v,i);return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;}).join(" ");
  const [firstX]=toXY(points[0],0);
  const [lastX]=toXY(points[points.length-1],points.length-1);
  const areaPath=`M${firstX},32 ${linePath.replace(/^M/,"L")} L${lastX},32 Z`;
  const color=positive?t.positive:t.negative;
  const gradId=`pg-${positive?"pos":"neg"}-${t.mode}`;
  return (
    <svg viewBox="0 0 100 40" style={{width:"100%",height:96,display:"block"}} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[8,16,24,32].map(y=>(
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={t.border} strokeWidth="0.4"/>
      ))}
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none"/>
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

