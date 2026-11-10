



import { useTheme } from "./theme.js";

export function DetailRow({label,value,valueColor}) {
  const t=useTheme();
  return (
    <div>
      <div style={{fontSize:11,color:t.textFaint,marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,color:valueColor||t.text}}>{value}</div>
    </div>
  );
}

