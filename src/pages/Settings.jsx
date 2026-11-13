import { useState, useEffect } from "react";

import { Check, Trash2, AlertTriangle, Wallet, Sun, Moon, Undo2, Tag, SlidersHorizontal, History, HardDriveDownload, RotateCcw } from "lucide-react";
import { fmt, initialState } from "../data/model.js";
import { readBackups, saveBackup } from "../data/backups.js";
import { THEME, THEME_COLOR_FIELDS, normalizeHex, FONT_MONO, useTheme, ConfirmModal, Card, Btn, Inp, SectionHeader, PageHeader, Segmented } from "../components/index.js";
import { Sell } from "./Sell.jsx";

export function Settings({state,dispatch,toast,theme,setTheme,themeColors,themePreviewColors,setThemePreviewColors}) {
  const t=useTheme();
  const [margin,setMargin]=useState(String(state.settings?.targetMargin||30));
  const [confirmingClear,setConfirmingClear]=useState(false);
  const [backups,setBackups]=useState(()=>readBackups());
  const [restoreTarget,setRestoreTarget]=useState(null);
  const [restoring,setRestoring]=useState(false);
  const activeSlot=Number(state.activeThemeSlot||1);
  const [targetSlot,setTargetSlot]=useState(activeSlot);
  const [colorDraft,setColorDraft]=useState(()=>({...((themeColors||{})[theme]||{})}));
  const [colorDraftErrors,setColorDraftErrors]=useState({});

  const baseTheme=THEME[theme]||THEME.dark;
  const paletteSlots=state.themePaletteSlots||{2:null,3:null,4:null,5:null};
  const activeSlotColors=activeSlot===1?{}:(paletteSlots[activeSlot]?.colors||{});

  useEffect(()=>{
    setTargetSlot(activeSlot);
    setColorDraft({...((themeColors||{})[theme]||{})});
    setColorDraftErrors({});
  },[theme,themeColors,activeSlot]);

  const getDraftColor=(key)=>normalizeHex(colorDraft[key])||baseTheme[key]||THEME.dark[key]||"#000000";
  const updateDraftColor=(key,value)=>{
    setColorDraft(prev=>({...prev,[key]:value}));
    const normalized=normalizeHex(value);
    setColorDraftErrors(prev=>({...prev,[key]:value.trim()&&!normalized?"Enter a valid HEX value, e.g. #E8A33D":""}));
    if(normalized){
      // Instant preview only. The shared /data state is updated only when saving a slot.
      setThemePreviewColors(prev=>({...((prev)||{}),[theme]:{
        ...((prev||{})[theme]||activeSlotColors),[key]:normalized
      }}));
    }
  };

  const clearCurrentPreview=()=>setThemePreviewColors(prev=>{
    const next={...(prev||{})};delete next[theme];return next;
  });

  const selectSlot=(slot)=>{
    setTargetSlot(slot);
    if(slot===1){
      dispatch({type:"SET_ACTIVE_THEME_SLOT",slot:1});
      clearCurrentPreview();
      setColorDraft({});
      setColorDraftErrors({});
      toast("Default palette selected");
      return;
    }
    const saved=paletteSlots[slot];
    if(saved?.colors){
      dispatch({type:"SET_ACTIVE_THEME_SLOT",slot});
      if(saved.mode&&saved.mode!==theme)setTheme(saved.mode);
      clearCurrentPreview();
      setColorDraft({...saved.colors});
      setColorDraftErrors({});
      toast(`Theme ${slot} selected`);
    }else{
      // Empty slot acts as the destination for the next save; current palette remains previewed.
      setColorDraft(prev=>({...prev}));
      toast(`Slot ${slot} is empty. Customize colors, then save to this slot.`);
    }
  };

  const applyColors=()=>{
    if(targetSlot===1){
      toast("Slot 1 is the default and cannot be overwritten. Choose slot 2–5 to save a custom theme.","error");
      return;
    }
    const normalized={};
    const errors={};
    for(const field of THEME_COLOR_FIELDS){
      const value=colorDraft[field.key] ?? baseTheme[field.key];
      const hex=normalizeHex(value);
      if(!hex)errors[field.key]="Enter a valid HEX value, e.g. #E8A33D";
      else normalized[field.key]=hex;
    }
    if(Object.keys(errors).length){setColorDraftErrors(errors);toast("Fix invalid HEX values before saving","error");return;}
    dispatch({type:"SAVE_THEME_PALETTE_SLOT",slot:targetSlot,mode:theme,name:`Theme ${targetSlot}`,colors:normalized});
    clearCurrentPreview();
    setColorDraft(normalized);
    setColorDraftErrors({});
    toast(`Theme saved to Slot ${targetSlot} and synced through the server`);
  };

  const resetColors=()=>{
    const defaults={};
    for(const field of THEME_COLOR_FIELDS)defaults[field.key]=baseTheme[field.key]||THEME.dark[field.key];
    setColorDraft(defaults);
    setColorDraftErrors({});
    setThemePreviewColors(prev=>({...((prev)||{}),[theme]:defaults}));
    toast("Default colors previewed. Choose Slot 2–5 and save to keep them as a custom theme.");
  };

  const discardColorChanges=()=>{
    const saved=targetSlot===1?{}:(paletteSlots[targetSlot]?.colors||activeSlotColors);
    setColorDraft({...saved});
    setColorDraftErrors({});
    clearCurrentPreview();
    toast("Unsaved color preview discarded");
  };

  const save=()=>{
    dispatch({type:"SET_SETTING",key:"targetMargin",value:parseFloat(margin)||30});
    toast("Settings saved");
  };

  const clearData=()=>{
    fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(initialState)})
      .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);window.location.reload();})
      .catch(()=>toast("Failed to clear data — check server connection","error"));
  };

  const createBackup=()=>{
    try{
      saveBackup(state);
      setBackups(readBackups());
      toast("Backup saved on this device");
    }catch{
      toast("Could not save backup. This device may be out of storage.","error");
    }
  };

  const restoreBackup=async()=>{
    if(!restoreTarget)return;
    setRestoring(true);
    try{
      saveBackup(state);
      const response=await fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(restoreTarget.state)});
      if(!response.ok)throw new Error(`Server returned ${response.status}`);
      toast("Backup restored. Reloading your saved version.","success");
      window.location.reload();
    }catch(error){
      setRestoring(false);
      setRestoreTarget(null);
      setBackups(readBackups());
      toast(`Restore failed: ${error.message}. Your current data is still open; try again.`,"error");
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {confirmingClear&&(
        <ConfirmModal title="Delete all data?" message="This permanently erases every part, build, sale, and wallet balance. This cannot be undone."
          confirmLabel="Delete everything" onConfirm={clearData} onCancel={()=>setConfirmingClear(false)}/>
      )}
      {restoreTarget&&(
        <ConfirmModal title="Load this backup?" message={`This replaces the current saved data with the version from ${new Date(restoreTarget.createdAt).toLocaleString()}. A safety backup of the current version will be saved on this device first.`}
          confirmLabel={restoring?"Restoring…":"Load this version"} danger={false} onConfirm={restoreBackup} onCancel={()=>!restoring&&setRestoreTarget(null)}/>
      )}
      <PageHeader title="Settings" sub="App preferences."/>
      <Card>
        <SectionHeader icon={Wallet} title="Business funds"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Business Bank</div>
            <div style={{fontSize:18,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(state.businessCash||0)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>Actual business bank balance</div>
          </div>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Cash</div>
            <div style={{fontSize:18,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(state.cashOnHand||0)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>Physical cash on hand</div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader icon={Tag} title="Selling defaults"/>
        <div style={{maxWidth:260}}>
          <Inp label="Target profit margin (%)" type="number" value={margin} onChange={e=>setMargin(e.target.value)}/>
        </div>
        <div style={{fontSize:11.5,color:t.textFaint,marginTop:8,marginBottom:14}}>Used to auto-suggest sale prices in the Sell tab and Quick Sell modal.</div>
        <Btn onClick={save}>Save</Btn>
      </Card>

      <Card>
        <SectionHeader icon={Sun} title="Appearance"/>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:8}}>Choose a base appearance. The active palette slot is shared through your PC Trader server, so the same selected theme loads on your PC and phone.</div>
        <Segmented ariaLabel="Theme" value={theme} onChange={setTheme} options={[["dark","Dark",Moon],["light","Light",Sun]]}/>
      </Card>

      <Card>
        <SectionHeader icon={SlidersHorizontal} title="Saved color themes"/>
        <div style={{fontSize:12,color:t.textMuted,lineHeight:1.55,marginBottom:12}}>
          Slot 1 is the original default palette. Save up to four custom palettes in Slots 2–5. Selecting a saved slot changes the website immediately; saving writes the palette to shared app data so it can sync across devices.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(112px,1fr))",gap:8}}>
          {[1,2,3,4,5].map(slot=>{
            const saved=slot===1?{name:"Default"}:paletteSlots[slot];
            const isActive=activeSlot===slot;
            const isTarget=targetSlot===slot;
            return <button key={slot} type="button" onClick={()=>selectSlot(slot)} className="bl-focusable"
              style={{textAlign:"left",padding:11,borderRadius:10,border:`1px solid ${isActive||isTarget?t.accent:t.border}`,background:isActive?t.accentSoft:t.surfaceSunken,color:t.text,cursor:"pointer",minHeight:70}}>
              <div style={{fontWeight:700,fontSize:12,display:"flex",justifyContent:"space-between",gap:5,alignItems:"center"}}>
                <span>{slot===1?"1 · Default":`${slot} · Theme ${slot}`}</span>
                {isActive&&<Check size={14} color={t.accent}/>}
              </div>
              <div style={{fontSize:10.5,color:t.textFaint,marginTop:6}}>{slot===1?"Built-in palette":saved?.colors?`Saved ${saved.name||`Theme ${slot}`}`:"Empty · save here"}</div>
              {isTarget&&!isActive&&<div style={{fontSize:9.5,color:t.accent,marginTop:3}}>Save destination</div>}
            </button>;
          })}
        </div>
      </Card>

      <Card>
        <SectionHeader icon={SlidersHorizontal} title="Theme color editor"/>
        <div style={{fontSize:12,color:t.textMuted,lineHeight:1.55,marginBottom:14}}>
          Edit a HEX value or use the color picker to preview the change across the whole website immediately. Choose an empty Slot 2–5 above as the save destination, then save the current palette there. Saved slots are stored with shared PC Trader data rather than only in this browser.
        </div>
        {[["Surfaces","Surface colors"],["Text","Text colors"],["Accents & Status","Accent and status colors"]].map(([group,title])=>{
          const fields=THEME_COLOR_FIELDS.filter(f=>f.group===group);
          return <div key={group} style={{marginBottom:18}}>
            <div style={{fontSize:12,fontWeight:700,color:t.text,marginBottom:9}}>{title}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:9}}>
              {fields.map(field=>{
                const hex=getDraftColor(field.key);
                const draftValue=colorDraft[field.key]??(themeColors?.[theme]?.[field.key]||baseTheme[field.key]||THEME.dark[field.key]);
                const invalid=!!colorDraftErrors[field.key] || (!!draftValue&&!normalizeHex(draftValue));
                return <div key={field.key} style={{display:"grid",gridTemplateColumns:"38px minmax(0,1fr)",alignItems:"center",gap:10,padding:10,border:`1px solid ${t.border}`,borderRadius:10,background:t.surfaceSunken}}>
                  <input type="color" value={hex} onChange={e=>updateDraftColor(field.key,e.target.value)} aria-label={`${field.label} color picker`} title={`Pick ${field.label}`} style={{width:38,height:38,padding:2,border:`1px solid ${t.borderStrong}`,borderRadius:8,background:t.surface,cursor:"pointer"}}/>
                  <div style={{minWidth:0}}>
                    <label htmlFor={`theme-color-${theme}-${field.key}`} style={{fontSize:11.5,color:t.textMuted,fontWeight:600,display:"block",marginBottom:5}}>{field.label}</label>
                    <input id={`theme-color-${theme}-${field.key}`} value={draftValue||""} spellCheck={false} autoCapitalize="characters" onChange={e=>updateDraftColor(field.key,e.target.value)} placeholder="#RRGGBB" aria-invalid={invalid}
                      style={{width:"100%",boxSizing:"border-box",minHeight:35,padding:"7px 9px",border:`1px solid ${invalid?t.negative:t.border}`,borderRadius:7,background:t.surface,color:t.text,fontFamily:FONT_MONO,fontSize:12,outline:"none"}}/>
                    {invalid&&<div style={{fontSize:10,color:t.negative,marginTop:4}}>Use #RGB or #RRGGBB</div>}
                  </div>
                </div>;
              })}
            </div>
          </div>;
        })}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",borderTop:`1px solid ${t.border}`,paddingTop:14}}>
          <Btn icon={Check} onClick={applyColors} disabled={targetSlot===1}>Save to Slot {targetSlot===1?"2–5":targetSlot}</Btn>
          <Btn variant="ghost" onClick={discardColorChanges}>Discard preview</Btn>
          <Btn variant="ghost" icon={Undo2} onClick={resetColors}>Preview defaults</Btn>
        </div>
        <div style={{marginTop:11,fontSize:10.5,color:t.textFaint}}>Soft accent backgrounds, borders, and focus rings automatically follow their matching accent colors. Preview changes are temporary until saved to Slot 2–5. Slot 1 always returns to the original palette.</div>
      </Card>

      <Card>
        <SectionHeader icon={History} title="Backup history" sub="Dated restore points saved in this browser on this device." action={
          <Btn small icon={HardDriveDownload} onClick={createBackup}>Save backup now</Btn>
        }/>
        {backups.length===0?<div style={{fontSize:13,color:t.textMuted,lineHeight:1.5}}>No backups yet. Save one now to create your first restore point.</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {backups.map(backup=><div key={backup.createdAt} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 12px",border:`1px solid ${t.border}`,borderRadius:10,background:t.surfaceSunken}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:t.text}}>{new Date(backup.createdAt).toLocaleString()}</div>
                <div style={{fontSize:11.5,color:t.textMuted,marginTop:3}}>{backup.state.parts.length} parts · {backup.state.sales.length} sales</div>
              </div>
              <Btn small variant="ghost" icon={RotateCcw} disabled={restoring} onClick={()=>setRestoreTarget(backup)}>Load this version</Btn>
            </div>)}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader icon={AlertTriangle} title="Data"/>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:14}}>Business data is saved to your database and synced across devices. Backup history is stored separately on this device and browser.</div>
        <Btn variant="danger" icon={Trash2} onClick={()=>setConfirmingClear(true)}>Clear all data</Btn>
      </Card>
    </div>
  );
}
