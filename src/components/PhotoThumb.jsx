

import { Tag } from "lucide-react";

import { useTheme } from "./theme.js";

export function PhotoThumb({url,size=52,seed=0,onClick,label}) {
  const t=useTheme();
  if(!url)return null;
  const tilt=((seed%5)-2)*1.6;
  const Tag=onClick?"button":"div";
  return (
    <Tag onClick={onClick} type={onClick?"button":undefined} aria-label={onClick?(label||"View photo"):undefined} className={onClick?"bl-focusable":undefined}
      style={{width:size,height:size,flexShrink:0,transform:`rotate(${tilt}deg)`,transition:"transform 0.2s",cursor:onClick?"pointer":"default",
        padding:0,border:"none",background:"none",display:"block"}}
      onMouseEnter={onClick?e=>e.currentTarget.style.transform=`rotate(0deg) scale(1.06)`:undefined}
      onMouseLeave={onClick?e=>e.currentTarget.style.transform=`rotate(${tilt}deg) scale(1)`:undefined}>
      <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:7,border:`2px solid ${t.border}`,boxShadow:t.shadowSm,display:"block"}}/>
    </Tag>
  );
}

