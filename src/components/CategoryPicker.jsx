import { useState } from "react";

import { Settings as SettingsIcon } from "lucide-react";
import { CATEGORIES, categoryKey, findBuiltInCategory, findCustomCategory } from "../data/model.js";
import { FONT_BODY, useTheme } from "./theme.js";
import { Btn } from "./Btn.jsx";
import { Sel } from "./Sel.jsx";

export function CategoryPicker({label,value,onChange,customCategories,dispatch,style,hiddenCategories=[],knownCategories=[],showManage=false,onManage}) {
  const t=useTheme();
  const [adding,setAdding]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDomain,setNewDomain]=useState("general");

  const hiddenKeys=new Set((hiddenCategories||[]).map(categoryKey));
  const builtIns=CATEGORIES.filter(c=>!hiddenKeys.has(categoryKey(c)));
  const custom=(customCategories||[]).filter(c=>c?.name&&!hiddenKeys.has(categoryKey(c.name)));
  const legacy=(knownCategories||[])
    .map(v=>String(v||"").trim().replace(/\s+/g," "))
    .filter(v=>v && !hiddenKeys.has(categoryKey(v)) && !findBuiltInCategory(v) && !findCustomCategory(v,custom))
    .reduce((acc,v)=>{ if(!acc.some(x=>categoryKey(x)===categoryKey(v))) acc.push(v); return acc; },[]);
  const options=[...builtIns,...custom.map(c=>c.name),...legacy];

  const handleSelect=(e)=>{
    if(e.target.value==="__add__"){setAdding(true);return;}
    onChange(e.target.value);
  };

  const confirmAdd=()=>{
    const name=newName.trim().replace(/\s+/g," ");
    if(!name)return;
    const duplicate=findBuiltInCategory(name)||findCustomCategory(name,customCategories)||
      (knownCategories||[]).find(v=>categoryKey(v)===categoryKey(name));
    if(duplicate){
      onChange(findBuiltInCategory(duplicate)||duplicate?.name||duplicate);
      setAdding(false);setNewName("");
      return;
    }
    dispatch({type:"ADD_CATEGORY",name,domain:newDomain});
    onChange(name);
    setAdding(false);setNewName("");setNewDomain("general");
  };

  if(adding){
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10,...style}}>
        <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600}}>New category</div>
        <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. iPhone or Motorcycle"
          style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:7,padding:"8px 9px",color:t.text,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/>
        <div style={{display:"flex",gap:6}}>
          {[['pc_part','PC part'],['general','General asset']].map(([v,l])=>(
            <button key={v} type="button" onClick={()=>setNewDomain(v)} className="bl-focusable"
              style={{flex:1,padding:"7px 8px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY,
                background:newDomain===v?t.accentSoft:t.surface,border:`1px solid ${newDomain===v?t.accentSoftBorder:t.border}`,color:newDomain===v?t.accent:t.textMuted}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn small onClick={confirmAdd} style={{flex:1}}>Add</Btn>
          <Btn small variant="ghost" onClick={()=>{setAdding(false);setNewName("");}} style={{flex:1}}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:5,...style}}>
      <Sel label={label} value={options.some(o=>categoryKey(o)===categoryKey(value))?value:"Other"} onChange={handleSelect} style={{}}>
        {options.map(c=><option key={`cat-${c}`} value={c}>{c}</option>)}
        <option value="__add__">+ Add category…</option>
      </Sel>
      {showManage&&(
        <Btn small variant="ghost" icon={SettingsIcon} onClick={onManage} style={{alignSelf:"flex-start"}}>Manage categories</Btn>
      )}
    </div>
  );
}

