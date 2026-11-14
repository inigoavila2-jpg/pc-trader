import { useState } from "react";

import { X, Plus, Pencil, Receipt, Monitor, Search } from "lucide-react";
import { fmt, today, uid, CATEGORIES, categoryKey, domainOf } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme, PhotoUpload, PhotoThumb, ConfirmModal, Card, Btn, IconBtn, Inp, PageHeader, CategoryPartPicker, EditBuildPartsModal, ReceiptPricePromptModal, BuildDetailSheet, ReceiptModal } from "../components/index.js";

export function Builds({state,dispatch,toast,openLightbox}) {
  const t=useTheme();
  const [creating,setCreating]=useState(false);
  const [buildName,setBuildName]=useState("");
  const [attemptedSave,setAttemptedSave]=useState(false);
  const [sel,setSel]=useState([]);
  const [activeCat,setActiveCat]=useState(null);
  const [pickerSearch,setPickerSearch]=useState("");
  const [buildSearch,setBuildSearch]=useState("");
  const [buildPhoto,setBuildPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [deletingBuild,setDeletingBuild]=useState(null);
  const [viewingBuild,setViewingBuild]=useState(null);
  const [editingBuild,setEditingBuild]=useState(null);
  const [receiptPromptBuild,setReceiptPromptBuild]=useState(null);
  const [buildReceipt,setBuildReceipt]=useState(null);
  // Domain Firewall: Builds must never see General Assets (phones, vehicles, etc.), only PC Parts.
  const avail=state.parts.filter(p=>p.status==="available"&&domainOf(p.category,state.customCategories)==="pc_part");
  const activeBuilds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const visibleBuilds=activeBuilds.filter(b=>b.name.toLowerCase().includes(buildSearch.trim().toLowerCase()));
  const buildCost=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0);
  const buildMarket=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.marketValue,0);
  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const hiddenKeys=new Set((state.hiddenCategories||[]).map(categoryKey));
  const customPcPartCats=(state.customCategories||[]).filter(c=>c.domain==="pc_part"&&!hiddenKeys.has(categoryKey(c.name))).map(c=>c.name);
  const categoriesPresent=[...CATEGORIES.filter(c=>!hiddenKeys.has(categoryKey(c))),...customPcPartCats].filter(c=>avail.some(p=>p.category===c));
  const selectedCountByCat=cat=>avail.filter(p=>p.category===cat&&sel.includes(p.id)).length;

  const submit=()=>{
    setAttemptedSave(true);
    if(!buildName.trim()||sel.length===0){toast("Name the build and pick parts","error");return;}
    dispatch({type:"CREATE_BUILD",build:{id:uid(),name:buildName,partIds:sel,date:today(),photoUrl:buildPhoto.photoUrl,photoRecordId:buildPhoto.photoRecordId}});
    toast(`Build "${buildName}" created`);
    setBuildName("");setSel([]);setCreating(false);setBuildPhoto({photoUrl:"",photoRecordId:""});setActiveCat(null);
  };
  const dissolve=b=>{dispatch({type:"DISSOLVE_BUILD",buildId:b.id});toast(`"${b.name}" dissolved — parts returned`);};
  const deleteBuildKeepParts=()=>{
    dispatch({type:"DELETE_BUILD",buildId:deletingBuild.id,returnParts:true});
    toast(`"${deletingBuild.name}" deleted — parts returned to inventory`,"warn");
    setDeletingBuild(null);
  };
  const deleteBuildAndParts=()=>{
    dispatch({type:"DELETE_BUILD",buildId:deletingBuild.id,returnParts:false});
    toast(`"${deletingBuild.name}" and its parts permanently deleted`,"warn");
    setDeletingBuild(null);
  };

  const copySpecs=(build,bp)=>{
    const lines=[`${build.name}`,"",...bp.map(p=>`• ${p.category}: ${p.name}${p.notes?` (${p.notes})`:""}`),"",`Asking price: ${fmt(bp.reduce((s,p)=>s+p.marketValue,0))}`];
    const text=lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      ()=>toast("Specs copied — paste into your listing"),
      ()=>toast("Couldn't copy — clipboard not available","error")
    );
  };

  const generateBuildReceipt=(build,bp,inputPrice)=>{
    const totalMarket=bp.reduce((s,p)=>s+(p.marketValue||0),0);
    const rows=bp.map(p=>{
      const share=totalMarket>0?(p.marketValue||0)/totalMarket:(bp.length?1/bp.length:0);
      return {...p,scaledPrice:share*inputPrice};
    });
    setBuildReceipt({rows,total:inputPrice,name:build.name});
    setReceiptPromptBuild(null);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {deletingBuild&&(
        <ConfirmModal title="Delete this build?" message={`What should happen to the parts in "${deletingBuild.name}"? Most of the time you want to keep them — only purge them if they're truly gone (e.g. parted out / destroyed).`}
          onCancel={()=>setDeletingBuild(null)}
          extraChoices={[
            {label:"Delete build, return parts to inventory (recommended)",onClick:deleteBuildKeepParts,variant:"success"},
            {label:"Delete build AND permanently destroy its parts",onClick:deleteBuildAndParts,variant:"danger"},
          ]}/>
      )}
      {editingBuild&&(
        <EditBuildPartsModal build={editingBuild} state={state} dispatch={dispatch} toast={toast} onClose={()=>setEditingBuild(null)}/>
      )}
      {viewingBuild&&(()=>{
        const bp=state.parts.filter(p=>viewingBuild.partIds.includes(p.id));
        return (
          <BuildDetailSheet build={viewingBuild} parts={bp} onClose={()=>setViewingBuild(null)} openLightbox={openLightbox}
            onDissolve={()=>{dissolve(viewingBuild);setViewingBuild(null);}}
            onCopySpecs={()=>copySpecs(viewingBuild,bp)}
            onDelete={()=>{setDeletingBuild(viewingBuild);setViewingBuild(null);}}
            onEdit={()=>{setEditingBuild(viewingBuild);setViewingBuild(null);}}/>
        );
      })()}
      {receiptPromptBuild&&(
        <ReceiptPricePromptModal buildName={receiptPromptBuild.name} onCancel={()=>setReceiptPromptBuild(null)}
          onConfirm={(price)=>generateBuildReceipt(receiptPromptBuild,state.parts.filter(p=>receiptPromptBuild.partIds.includes(p.id)),price)}/>
      )}
      {buildReceipt&&(
        <ReceiptModal title={buildReceipt.name} date={today()} total={buildReceipt.total}
          receiptRows={buildReceipt.rows} onClose={()=>setBuildReceipt(null)}/>
      )}

      <PageHeader title="Builds" sub="Group parts into a sellable PC." action={!creating&&<Btn icon={Plus} onClick={()=>{setAttemptedSave(false);setCreating(true);}}>New build</Btn>}/>

      {creating&&(
        <Card>
          <div style={{fontWeight:700,fontSize:13.5,color:t.text,marginBottom:14,fontFamily:FONT_DISPLAY}}>New build</div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Build photo (optional) — the finished PC" photoUrl={buildPhoto.photoUrl} photoRecordId={buildPhoto.photoRecordId} onChange={setBuildPhoto}/>
          </div>
          <Inp label="Build name" value={buildName} onChange={e=>setBuildName(e.target.value)} placeholder="Gaming Rig #1" autoFocus error={attemptedSave&&!buildName.trim()?"Enter a name for this build.":undefined}/>

          <div style={{fontSize:12,color:t.textMuted,fontWeight:600,margin:"16px 0 9px"}}>Pick parts by category:</div>
          <CategoryPartPicker avail={avail} categoriesPresent={categoriesPresent} activeCat={activeCat} setActiveCat={setActiveCat}
            search={pickerSearch} setSearch={setPickerSearch} selectedIds={sel} onToggle={toggle} selectedCountByCat={selectedCountByCat}/>
          {attemptedSave&&sel.length===0&&<div role="alert" style={{fontSize:12,color:t.negative,marginTop:8}}>Choose at least one part for this build.</div>}

          {sel.length>0&&(
            <div style={{marginTop:4,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:9}}>Selected ({sel.length}):</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12,maxHeight:160,overflowY:"auto"}}>
                {avail.filter(p=>sel.includes(p.id)).map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <PhotoThumb url={p.photoUrl} size={26} seed={p.id.length}/>
                    <span style={{color:t.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span style={{fontFamily:FONT_MONO,color:t.textFaint}}>{fmt(p.allocatedCost)}</span>
                    <IconBtn icon={X} label={`Remove ${p.name} from selection`} size={26} iconSize={13} onClick={()=>toggle(p.id)}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:t.textMuted}}>Build cost so far</span><span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(buildCost)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:t.textMuted}}>Estimated market value</span><span style={{fontFamily:FONT_MONO,color:t.textMuted}}>{fmt(buildMarket)}</span>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn onClick={submit} disabled={!buildName||sel.length===0}>Save build</Btn>
            <Btn variant="ghost" onClick={()=>{setCreating(false);setSel([]);setBuildName("");setActiveCat(null);setAttemptedSave(false);}}>Cancel</Btn>
          </div>
        </Card>
      )}

      {activeBuilds.length>0&&<Inp value={buildSearch} onChange={e=>setBuildSearch(e.target.value)} placeholder="Search active builds…" icon={Search} aria-label="Search active builds"/>}
      {activeBuilds.length===0&&!creating?(
        <Card style={{textAlign:"center",padding:36}}>
          <Monitor size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
          <div style={{color:t.textFaint}}>No active builds.</div>
        </Card>
      ):visibleBuilds.length===0&&!creating?(
        <Card style={{textAlign:"center",padding:28}}><div style={{color:t.text,fontWeight:600}}>No builds match “{buildSearch}”.</div><Btn small variant="ghost" onClick={()=>setBuildSearch("")} style={{marginTop:10}}>Clear search</Btn></Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {visibleBuilds.map(build=>{
            const bp=state.parts.filter(p=>build.partIds.includes(p.id));
            const cost=bp.reduce((s,p)=>s+p.allocatedCost,0);
            const market=bp.reduce((s,p)=>s+p.marketValue,0);
            return (
              <Card key={build.id} style={{padding:0,overflow:"hidden"}}>
                {/* Photo + header open the detail sheet; this is a real <button> so it's keyboard-
                    reachable, which means the quick actions below must be siblings, not nested
                    inside it — a button can't legally contain another button. */}
                <button onClick={()=>setViewingBuild(build)} aria-label={`${build.name}, ${bp.length} parts, ${fmt(cost)}`} className="bl-focusable"
                  style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:0,margin:0,cursor:"pointer",font:"inherit"}}>
                  <div style={{width:"100%",aspectRatio:"16/9",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
                    {build.photoUrl?(
                      <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    ):(
                      <Monitor size={34} strokeWidth={1.5} color={t.textFaint}/>
                    )}
                  </div>
                  <div style={{padding:"16px 16px 0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                      <div><div style={{color:t.text,fontWeight:700,fontSize:15,fontFamily:FONT_DISPLAY}}>{build.name}</div>
                        <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{build.date} · {bp.length} parts</div></div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(cost)}</div>
                        <div style={{fontSize:10,color:t.textFaint}}>market {fmt(market)}</div>
                      </div>
                    </div>
                  </div>
                </button>

                <div style={{padding:"12px 16px 16px"}}>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <Btn small variant="ghost" icon={Pencil} onClick={()=>setEditingBuild(build)} style={{flex:1}}>Edit parts</Btn>
                    <Btn small variant="ghost" icon={Receipt} onClick={()=>setReceiptPromptBuild(build)} style={{flex:1}}>Make a receipt</Btn>
                  </div>

                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {bp.map(p=>(
                      <span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:t.surfaceHover,border:`1px solid ${t.border}`,
                        borderRadius:99,fontSize:11,padding:"4px 10px",color:t.textMuted}}>
                        <span style={{color:t.accent,fontWeight:600}}>{p.category}</span>
                        <span style={{color:t.text}}>{p.name}</span>
                        <span style={{color:t.textFaint}}>{fmt(p.allocatedCost)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
