import { useState, useEffect, useRef } from "react";

import { Boxes, Wrench, Settings as SettingsIcon, Search, X, Trash2, PackageX } from "lucide-react";
import { fmt, today, uid } from "../data/model.js";
import { FONT_DISPLAY, FONT_BODY, FONT_MONO, useTheme, STATUS_LABEL, StatusBadge, PhotoThumb, ConfirmModal, Card, Btn, IconBtn, Inp, Sel, PageHeader, DefectiveModal, QuickSellModal, EditPartModal, PartDetailSheet, PartGroupSheet } from "../components/index.js";
import { CategoryManager } from "../components/CategoryManager.jsx";
import { Builds } from "./Builds.jsx";
import { useMediaQuery } from "../hooks/appHooks.js";

export function Inventory({state,dispatch,toast,setTab,jumpTo,openLightbox,jumpRequest,onRecordChange}) {
  const t=useTheme();
  const isDesktop=useMediaQuery("(min-width: 1024px)");
  const [categoryManagerOpen,setCategoryManagerOpen]=useState(false);
  const [statusFilter,setStatusFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [partIdsFilter,setPartIdsFilter]=useState(null);
  const [sortBy,setSortBy]=useState("name");
  const [viewing,setViewing]=useState(null); // part shown in the detail sheet
  const lastPartId=useRef(null);
  const [viewingGroup,setViewingGroup]=useState(null); // group of identical parts shown in the group sheet
  const [bundleView,setBundleView]=useState(false);
  const [quickSell,setQuickSell]=useState(null);
  const [editing,setEditing]=useState(null);
  const [deleting,setDeleting]=useState(null); // part pending delete confirmation
  // Global search deep-links here: arriving with a query clears any stale filters so the
  // result the person tapped is actually visible, not hidden behind a leftover status filter.
  useEffect(()=>{
    if(jumpRequest){
      if(jumpRequest.query||jumpRequest.partIds||jumpRequest.partId){
        setSearch(jumpRequest.query||"");
        setStatusFilter("all");
        setCatFilter("all");
        setBundleView(false);
        setPartIdsFilter(jumpRequest.partIds||null);
      }
      if(jumpRequest.partId){
        const selected=state.parts.find(part=>part.id===jumpRequest.partId);
        if(selected)setViewing(selected);
      }else setViewing(null);
    }
  },[jumpRequest,state.parts]);
  useEffect(()=>{
    if(lastPartId.current===viewing?.id)return;
    lastPartId.current=viewing?.id||null;
    onRecordChange?.("part",viewing?.id);
  },[viewing?.id,onRecordChange]);
  const [defectiveTarget,setDefectiveTarget]=useState(null); // part pending defective confirmation
  const {parts,settings,builds,bundles}=state;

  // Look up which build (by name) a part currently belongs to, for the "Used in Build X" status line
  const buildNameFor=p=>{
    if(p.status!=="in_build")return null;
    const b=builds.find(b=>!b.dissolved&&b.partIds.includes(p.id));
    return b?b.name:null;
  };

  const categoriesPresent=[...new Set(parts.map(p=>p.category))];

  const filtered=parts.filter(p=>{
    if(partIdsFilter&&!partIdsFilter.includes(p.id))return false;
    if(statusFilter!=="all"&&p.status!==statusFilter)return false;
    if(catFilter!=="all"&&p.category!==catFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.category.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>sortBy==="cost-high"?b.allocatedCost-a.allocatedCost:sortBy==="cost-low"?a.allocatedCost-b.allocatedCost:sortBy==="market-high"?b.marketValue-a.marketValue:sortBy==="status"?(STATUS_LABEL[a.status]||a.status).localeCompare(STATUS_LABEL[b.status]||b.status):a.name.localeCompare(b.name));

  // Restocking the same item (e.g. buying 20 identical power cables) still creates 20
  // independently-trackable part records under the hood — each can still be sold, built, or
  // marked defective on its own. This only changes how they're DISPLAYED: identical parts
  // (same name, category, cost, market value, and status) collapse into a single card with a
  // quantity badge, instead of cluttering the grid with 20 near-identical cards. Anything
  // that's the only one of its kind renders exactly as a normal single card, unchanged.
  const groupKey=p=>`${p.name}|${p.category}|${Math.round(p.allocatedCost)}|${Math.round(p.marketValue)}|${p.status}`;
  const groupMap=new Map();
  filtered.forEach(p=>{
    const k=groupKey(p);
    if(!groupMap.has(k))groupMap.set(k,[]);
    groupMap.get(k).push(p);
  });
  const groupedCards=[...groupMap.values()]; // each entry is an array of 1+ identical parts

  const handleQuickSell=(sp,buyer,paymentAccount="bank")=>{
    if(!quickSell)return;
    const p=quickSell;
    const sale={id:uid(),partId:p.id,name:p.name,cost:p.allocatedCost,salePrice:sp,profit:sp-p.allocatedCost,buyerName:buyer,date:today(),paymentAccount};
    dispatch({type:"SELL",mode:"part",id:p.id,sale});
    toast(`${p.name} sold for ${fmt(sp)} — profit ${fmt(sp-p.allocatedCost)}`,sp-p.allocatedCost>=0?"success":"warn");
    setQuickSell(null);setViewing(null);
  };

  const handleEdit=(changes,desc)=>{
    dispatch({type:"UPDATE_PART",id:editing.id,changes,desc});
    toast(`${editing.name} updated`);
    setEditing(null);
  };

  const confirmDelete=()=>{
    if(deleting._isBundle)return; // handled by the dual-choice modal instead
    if(deleting.status==="in_build"){
      toast(`Can't delete — "${deleting.name}" is still in a build. Dissolve that build first.`,"error");
      setDeleting(null);return;
    }
    dispatch({type:"DELETE_PART",id:deleting.id});
    toast(`${deleting.name} deleted`,"warn");
    setDeleting(null);setViewing(null);
  };

  const deleteBundleWithParts=()=>{
    dispatch({type:"DELETE_BUNDLE",bundleId:deleting.id,mode:"parts-too"});
    toast(`"${deleting.name}" and its parts deleted`,"warn");
    setDeleting(null);
  };

  const deleteBundleKeepParts=()=>{
    dispatch({type:"DELETE_BUNDLE",bundleId:deleting.id,mode:"keep-loose"});
    toast(`"${deleting.name}" removed — parts kept as loose inventory`,"warn");
    setDeleting(null);
  };

  const confirmDefective=(reason)=>{
    dispatch({type:"MARK_DEFECTIVE",id:defectiveTarget.id,reason});
    toast(`${defectiveTarget.name} marked defective — logged as a loss`,"warn");
    setDefectiveTarget(null);setViewing(null);
  };

  const duplicatePart=(p)=>{
    dispatch({type:"DUPLICATE_PART",id:p.id});
    toast(`Duplicated ${p.name}`);
    setViewing(null);
  };

  const goAddToBuild=()=>{
    const partId=viewing?.id;
    setViewing(null);
    toast("This part is selected. Add any other parts, then name the build.");
    if(jumpTo)jumpTo("Builds",{addPartId:partId});
    else setTab("Builds");
  };

  const goToBuild=()=>{
    setViewing(null);
    toast("Find this build on the Builds tab to dissolve it");
    setTab("Builds");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {categoryManagerOpen&&<CategoryManager state={state} dispatch={dispatch} toast={toast} onClose={()=>setCategoryManagerOpen(false)}/>}
      {quickSell&&<QuickSellModal part={quickSell} onClose={()=>setQuickSell(null)} onConfirm={handleQuickSell} targetMargin={settings?.targetMargin||30}/>}
      {editing&&<EditPartModal part={editing} onClose={()=>setEditing(null)} onSave={handleEdit} dispatch={dispatch} customCategories={state.customCategories} hiddenCategories={state.hiddenCategories||[]}/>}
      {deleting&&!deleting._isBundle&&(
        <ConfirmModal title="Delete this part?" message={`"${deleting.name}" will be permanently removed. This can't be undone.`}
          onConfirm={confirmDelete} onCancel={()=>setDeleting(null)}/>
      )}
      {deleting&&deleting._isBundle&&(
        <ConfirmModal title="Delete this bundle?" message={`What should happen to the parts that came from "${deleting.name}"? Most of the time you want to keep them as loose inventory.`}
          onCancel={()=>setDeleting(null)}
          extraChoices={[
            {label:"Delete bundle, keep parts as loose inventory (recommended)",onClick:deleteBundleKeepParts,variant:"success"},
            {label:"Delete bundle AND permanently destroy its parts",onClick:deleteBundleWithParts,variant:"danger"},
          ]}/>
      )}
      {defectiveTarget&&(
        <DefectiveModal part={defectiveTarget} onConfirm={confirmDefective} onCancel={()=>setDefectiveTarget(null)}/>
      )}
      {viewingGroup&&(
        <PartGroupSheet group={viewingGroup} onClose={()=>setViewingGroup(null)}
          onViewUnit={(unit)=>{setViewing(unit);setViewingGroup(null);}}/>
      )}
      {viewing&&(
        <PartDetailSheet part={viewing} buildName={buildNameFor(viewing)} onClose={()=>setViewing(null)}
          openLightbox={openLightbox}
          onQuickSell={()=>{setQuickSell(viewing);setViewing(null);}}
          onEdit={()=>{setEditing(viewing);setViewing(null);}}
          onDefective={()=>{setDefectiveTarget(viewing);setViewing(null);}}
          onDelete={()=>{setDeleting(viewing);setViewing(null);}}
          onDuplicate={()=>duplicatePart(viewing)}
          onAddToBuild={goAddToBuild}
          onGoToBuild={goToBuild}/>
      )}

      <PageHeader title="Inventory" sub={`${parts.length} part${parts.length===1?"":"s"} tracked`}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:-8}}><Btn small variant="ghost" icon={SettingsIcon} onClick={()=>setCategoryManagerOpen(true)}>Manage categories</Btn></div>

      <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or category…" icon={Search} aria-label="Search inventory"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,190px),1fr))",gap:10}}>
        <Sel label="Sort inventory" value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Sort inventory">
          <option value="name">Name A–Z</option><option value="cost-high">Cost: high to low</option><option value="cost-low">Cost: low to high</option><option value="market-high">Market value: high to low</option><option value="status">Status</option>
        </Sel>
        {(search||catFilter!=="all"||statusFilter!=="all"||bundleView||partIdsFilter)&&<Btn variant="ghost" icon={X} onClick={()=>{setSearch("");setCatFilter("all");setStatusFilter("all");setBundleView(false);setPartIdsFilter(null);}}>Clear filters</Btn>}
      </div>

      {categoriesPresent.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Btn small variant={catFilter==="all"?"primary":"ghost"} onClick={()=>setCatFilter("all")}>All categories</Btn>
          {categoriesPresent.map(c=>(
            <Btn key={c} small variant={catFilter===c?"primary":"ghost"} onClick={()=>setCatFilter(c)}>{c}</Btn>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {["all","available","in_build","sold","defective"].map(f=>{
          const active=!bundleView&&statusFilter===f;
          return (
            <Btn key={f} small variant={active?"primary":"ghost"} onClick={()=>{setStatusFilter(f);setBundleView(false);}}>
              {f==="all"?"All":f.replace("_"," ")}
              <span style={{background:active?"rgba(255,255,255,0.22)":(t.mode==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"),borderRadius:99,padding:"1px 6px",fontSize:10.5,marginLeft:2}}>
                {f==="all"?parts.length:parts.filter(p=>p.status===f).length}
              </span>
            </Btn>
          );
        })}
        <Btn small variant={bundleView?"primary":"ghost"} icon={Boxes} onClick={()=>setBundleView(true)}>Bundles</Btn>
      </div>

      {bundleView?(
        bundles.length===0?(
          <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No bundles yet.</div></Card>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {bundles.map((b,i)=>{
              const bParts=parts.filter(p=>p.bundleId===b.id);
              return (
                <Card key={b.id} style={{animation:`blFadeUp 0.2s ease ${i*0.03}s both`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
                    <div style={{display:"flex",gap:11,minWidth:0}}>
                      {b.photoUrl&&<PhotoThumb url={b.photoUrl} size={56} seed={i} onClick={()=>openLightbox(b.photoUrl)} label={`View photo of ${b.name}`}/>}
                      <div>
                        <div style={{color:t.text,fontWeight:700,fontSize:14,fontFamily:FONT_DISPLAY}}>{b.name}</div>
                        <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{b.date} · {bParts.length} parts · paid {fmt(b.purchasePrice)}</div>
                      </div>
                    </div>
                    <IconBtn icon={Trash2} label={`Delete bundle ${b.name}`} variant="danger" onClick={()=>setDeleting({...b,_isBundle:true})}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
                    {bParts.map(p=>(
                      <button key={p.id} onClick={()=>setViewing(p)} className="bl-focusable" style={{display:"flex",alignItems:"center",gap:9,fontSize:12,
                        cursor:"pointer",background:"none",border:"none",padding:"6px 4px",borderRadius:7,width:"100%",textAlign:"left",fontFamily:FONT_BODY}}
                        onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length}/>
                        <span style={{color:t.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                        <span style={{color:t.textFaint,fontSize:10.5}}>{p.category}</span>
                        <StatusBadge s={p.status}/>
                        <span style={{fontFamily:FONT_MONO,color:t.textMuted,fontSize:11}}>{fmt(p.allocatedCost)}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ):filtered.length===0?(
        <Card style={{textAlign:"center",padding:36}}>
          <PackageX size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
          <div style={{color:t.textFaint}}>{search?"No parts match your search.":"No parts here yet."}</div>
          {(search||catFilter!=="all"||statusFilter!=="all")&&<Btn small variant="ghost" icon={X} onClick={()=>{setSearch("");setCatFilter("all");setStatusFilter("all");}} style={{marginTop:12}}>Clear filters</Btn>}
        </Card>
      ):(
        /* Marketplace-style card grid — replaces the old always-expanded list so scanning
           50-100+ parts is fast, with full detail only a tap away. Column count now scales
           with available width instead of being frozen at 2, so it uses desktop space. */
        isDesktop?(
        <div style={{display:"flex",flexDirection:"column",border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden",background:t.surface}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(170px,2fr) minmax(90px,1fr) minmax(80px,1fr) minmax(95px,1fr) minmax(125px,1.4fr)",gap:12,padding:"10px 14px",background:t.surfaceSunken,color:t.textFaint,fontSize:11,fontWeight:700}}>
            <span>ITEM</span><span>STATUS</span><span>CATEGORY</span><span style={{textAlign:"right"}}>COST</span><span style={{textAlign:"right"}}>MARKET / UPSIDE</span>
          </div>
          {groupedCards.map(group=>{
            const p=group[0];
            const count=group.length;
            const potential=(p.marketValue-p.allocatedCost)*count;
            return <button key={groupKey(p)} onClick={()=>count>1?setViewingGroup(group):setViewing(p)} aria-label={`${p.name}${count>1?`, ${count} units`:""}, ${STATUS_LABEL[p.status]||p.status}, cost ${fmt(p.allocatedCost)}`} className="bl-focusable"
              style={{display:"grid",gridTemplateColumns:"minmax(170px,2fr) minmax(90px,1fr) minmax(80px,1fr) minmax(95px,1fr) minmax(125px,1.4fr)",gap:12,alignItems:"center",padding:"10px 14px",border:0,borderBottom:`1px solid ${t.border}`,background:"transparent",textAlign:"left",cursor:"pointer",fontFamily:FONT_BODY}}>
              <span style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}><PhotoThumb url={p.photoUrl} size={38} seed={p.id.length}/><span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13,fontWeight:600,color:t.text}}>{p.name}{count>1&&<span style={{marginLeft:6,color:t.accent}}>×{count}</span>}</span></span>
              <StatusBadge s={p.status}/>
              <span style={{fontSize:12,color:t.textMuted,overflow:"hidden",textOverflow:"ellipsis"}}>{p.category}</span>
              <span style={{fontFamily:FONT_MONO,fontSize:12,textAlign:"right",color:t.text}}>{fmt(p.allocatedCost*count)}</span>
              <span style={{fontFamily:FONT_MONO,fontSize:12,textAlign:"right",color:potential>=0?t.positive:t.negative}}>{fmt(p.marketValue*count)} · {potential>=0?"+":""}{fmt(potential)}</span>
            </button>;
          })}
        </div>
        ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
          {groupedCards.map((group,i)=>{
            const p=group[0]; // representative — identical across the whole group by definition
            const count=group.length;
            const potential=p.marketValue-p.allocatedCost;
            const onCardClick=count>1?()=>setViewingGroup(group):()=>setViewing(p);
            const ariaLabel=`${p.name}, ${p.category}, ${STATUS_LABEL[p.status]||p.status}, ${fmt(p.allocatedCost)}${count>1?` each, ${count} units`:""}`;
            return (
              <button key={groupKey(p)} onClick={onCardClick} aria-label={ariaLabel} className="bl-focusable bl-card-btn" style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:13,
                padding:10,cursor:"pointer",animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`,transition:"border-color 0.15s,transform 0.1s",
                position:"relative",textAlign:"left",fontFamily:FONT_BODY,display:"block"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;}}
                onMouseDown={e=>e.currentTarget.style.transform="scale(0.98)"}
                onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
                <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:t.surfaceSunken,marginBottom:8,
                  display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`,position:"relative"}}>
                  {p.photoUrl?(
                    <img src={p.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  ):(
                    <Wrench size={24} strokeWidth={1.5} color={t.textFaint}/>
                  )}
                  {count>1&&(
                    <div style={{position:"absolute",top:6,right:6,background:t.accentStrong,color:t.accentContrast,fontSize:11,fontWeight:800,
                      padding:"3px 8px",borderRadius:99,boxShadow:t.shadowSm}}>×{count}</div>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:4}}>
                  <StatusBadge s={p.status}/>
                  <span style={{color:t.textFaint,fontSize:9.5,whiteSpace:"nowrap"}}>{p.category}</span>
                </div>
                <div style={{color:t.text,fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
                <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}>
                  {fmt(p.allocatedCost)}{count>1&&<span style={{color:t.textFaint,fontWeight:500,fontSize:11}}> each</span>}
                </div>
                {count>1?(
                  <div style={{fontSize:10,color:t.accent,marginTop:2,fontWeight:600}}>Total {fmt(p.allocatedCost*count)} · view all {count}</div>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.textFaint,marginTop:2}}>
                    <span>Market {fmt(p.marketValue)}</span>
                    <span style={{color:potential>=0?t.positive:t.negative,fontWeight:600}}>{potential>=0?"+":""}{fmt(potential)}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        )
      )}
    </div>
  );
}
