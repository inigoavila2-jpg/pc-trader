import { useState, useEffect, useRef, useCallback } from "react";
import { AIAgentChatbox } from "./components/AIAgentChatbox";

/* ═══════════════════════════════════════════
   GLOBALS & UTILS
═══════════════════════════════════════════ */
const CURRENCY = "₱";
const fmt = (n) => `${CURRENCY}${Number(n).toLocaleString("en-PH",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const pct = (n) => `${(n*100).toFixed(1)}%`;
const today = () => new Date().toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
let _id = Date.now();
const uid = () => `id_${_id++}`;
const CATEGORIES = ["GPU","CPU","Motherboard","CPU+MB","RAM","PSU","Storage","Cooler","Case","Monitor","Other"];

// Every built-in category is a PC part by definition. Custom categories (added via the
// "+ Add Category" picker) carry their own domain in state.customCategories, looked up at
// render/dispatch time rather than re-derived from the category name string.
function domainOf(category, customCategories){
  if(CATEGORIES.includes(category))return "pc_part";
  const custom=customCategories?.find(c=>c.name===category);
  return custom?custom.domain:"pc_part"; // safe default — never silently misfile into General Assets
}
const TABS = ["Dashboard","Buy","Inventory","Builds","Sell","History"];
const initialState = { bundles:[], parts:[], builds:[], sales:[], settings:{ targetMargin:30 }, customCategories:[], quickNotes:[], businessCash:14500, personalCash:0, expenses:[] };

/* ═══════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════ */
function reducer(state, action) {
  switch(action.type) {
    case "ADD_BUNDLE":
      return {...state, bundles:[...state.bundles,action.bundle], parts:[...state.parts,...action.parts], 
        businessCash:(state.businessCash||0)-(action.bundle.purchasePrice||0)}; // cash out for bundle purchase
    case "ADD_PARTS": {
      const totalCost=action.parts.reduce((s,p)=>s+(p.allocatedCost||0),0);
      return {...state, parts:[...state.parts,...action.parts], businessCash:(state.businessCash||0)-totalCost}; // cash out for purchases
    }
    case "UPDATE_PART": {
      return {...state, parts: state.parts.map(p => p.id === action.id
        ? {...p, ...action.changes, history:[...p.history,{date:today(),event:`Edited: ${action.desc}`}]}
        : p
      )};
    }
    case "CREATE_BUILD": {
      const {build} = action;
      return {...state, builds:[...state.builds,build],
        parts: state.parts.map(p => build.partIds.includes(p.id)
          ? {...p,status:"in_build",history:[...p.history,{date:today(),event:`Added to build: ${build.name}`}]}
          : p
        )};
    }
    case "DISSOLVE_BUILD": {
      const build = state.builds.find(b=>b.id===action.buildId);
      return {...state,
        builds: state.builds.map(b=>b.id===action.buildId?{...b,dissolved:true}:b),
        parts: state.parts.map(p=>build?.partIds.includes(p.id)&&p.status==="in_build"
          ? {...p,status:"available",history:[...p.history,{date:today(),event:`Removed from build: ${build.name}`}]}
          : p
        )};
    }
    case "SELL": {
      const {mode,id,sale} = action;
      if(mode==="part") {
        return {...state, sales:[...state.sales,sale],
          businessCash:(state.businessCash||0)+sale.salePrice, // cash in from the sale
          parts: state.parts.map(p=>p.id===id
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)} — profit ${fmt(sale.profit)}`}]}
            : p
          )};
      } else {
        const build = state.builds.find(b=>b.id===id);
        return {...state, sales:[...state.sales,sale],
          businessCash:(state.businessCash||0)+sale.salePrice, // cash in from the sale
          builds: state.builds.map(b=>b.id===id?{...b,sold:true}:b),
          parts: state.parts.map(p=>build?.partIds.includes(p.id)
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold in build "${build.name}" to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)}`}]}
            : p
          )};
      }
    }
    case "SET_SETTING":
      return {...state, settings:{...state.settings,[action.key]:action.value}};

    // Dynamic Tag Generation — saves a new category permanently with its domain (PC Part or
    // General Asset), so it persists across sessions and appears in future dropdowns.
    case "ADD_CATEGORY": {
      const {name,domain}=action;
      if(!name||state.customCategories?.some(c=>c.name===name)||CATEGORIES.includes(name))return state;
      return {...state, customCategories:[...(state.customCategories||[]),{name,domain}]};
    }

    // Quick Actions toolbar's "Note" option — a fast scratchpad entry with no other fields,
    // for jotting something down on the spot without opening a full form.
    case "ADD_QUICK_NOTE": {
      if(!action.text?.trim())return state;
      return {...state, quickNotes:[...(state.quickNotes||[]),{id:uid(),text:action.text.trim(),date:today()}]};
    }
    case "DELETE_QUICK_NOTE":
      return {...state, quickNotes:(state.quickNotes||[]).filter(n=>n.id!==action.id)};

    // Mixed-Finance Tracker: record business expenses and personal draws, with separate tracking
    // for funds to recover (owner's draw) vs business costs (operation).
    case "ADD_EXPENSE": {
      const {expenseType,amount,description,wallet}=action; // expenseType: "business" | "personal_draw"
      const newExpense={id:uid(),type:expenseType,amount,description,date:today(),wallet};
      const newTransaction={id:uid(),type:"EXPENSE",amount,description,wallet,date:today()};
      if (wallet === "personal") {
        return {...state,
          expenses:[...(state.expenses||[]),newExpense],
          transactions:[newTransaction, ...(state.transactions||[])],
          personalCash:(state.personalCash||0)-amount};
      } else {
        return {...state,
          expenses:[...(state.expenses||[]),newExpense],
          transactions:[newTransaction, ...(state.transactions||[])],
          businessCash:(state.businessCash||0)-amount};
      }
    }
    case "ADD_INCOME": {
      const {amount,description,wallet} = action;
      const newTransaction={id:uid(),type:"INCOME",amount,description,wallet,date:today()};
      return {...state,
        transactions:[newTransaction, ...(state.transactions||[])],
        [`${wallet}Cash`]: (state[`${wallet}Cash`]||0) + amount};
    }
    case "TRANSFER_FUNDS": {
      const { amount, direction } = action;
      const transferRecord={
        id:uid(),
        type:"TRANSFER",
        amount,
        description: direction==="to_personal"?"Transfer to Personal Wallet":"Transfer to Business Wallet",
        from: direction==="to_personal"?"business":"personal",
        to: direction==="to_personal"?"personal":"business",
        date:today(),
      };
      if (direction === "to_personal") {
        return { ...state,
          businessCash: (state.businessCash||0) - amount,
          personalCash: (state.personalCash||0) + amount,
          transactions:[transferRecord, ...(state.transactions||[])] };
      } else {
        return { ...state,
          personalCash: (state.personalCash||0) - amount,
          businessCash: (state.businessCash||0) + amount,
          transactions:[transferRecord, ...(state.transactions||[])] };
      }
    }

    // Direct cash balance update (used by SELL to add revenue, or other revenue sources)
    case "UPDATE_LIQUID_CASH":
      return {...state, businessCash:(state.businessCash||0)+action.amount};

    // Reverses a completed sale: removes it from active totals (soft-deleted, not erased — kept
    // for the "Returned sales" filter), and returns the part(s)/build back to available inventory.
    case "UNDO_SALE": {
      const {saleId,reason}=action;
      const sale=state.sales.find(s=>s.id===saleId);
      if(!sale)return state;
      let parts=state.parts;
      let builds=state.builds;
      if(sale.buildId){
        const build=state.builds.find(b=>b.id===sale.buildId);
        builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false}:b);
        parts=state.parts.map(p=>build?.partIds.includes(p.id)
          ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:`Sale undone (${reason}) — returned to inventory`}]}
          : p);
      } else if(sale.partId){
        parts=state.parts.map(p=>p.id===sale.partId
          ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:`Sale undone (${reason}) — returned to inventory`}]}
          : p);
      }
      return {...state, parts, builds,
        sales: state.sales.map(s=>s.id===saleId?{...s,returned:true,returnReason:reason,returnedAt:today()}:s)
      };
    }

    case "EDIT_SALE": {
      const {saleId,changes}=action;
      return {...state, sales: state.sales.map(s=>s.id===saleId
        ? {...s,...changes,profit:(changes.salePrice??s.salePrice)-s.cost,edited:true,editedAt:today()}
        : s)};
    }

    // Soft-deletes a sale record. mode "record-only" just hides it from active lists (kept for
    // the "Deleted records" filter). mode "undo-and-return" also reverses the sale like UNDO_SALE.
    case "DELETE_SALE": {
      const {saleId,mode}=action;
      const sale=state.sales.find(s=>s.id===saleId);
      if(!sale)return state;
      let parts=state.parts;
      let builds=state.builds;
      if(mode==="undo-and-return"){
        if(sale.buildId){
          const build=state.builds.find(b=>b.id===sale.buildId);
          builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false}:b);
          parts=state.parts.map(p=>build?.partIds.includes(p.id)
            ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:"Sale record deleted — returned to inventory"}]}
            : p);
        } else if(sale.partId){
          parts=state.parts.map(p=>p.id===sale.partId
            ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:"Sale record deleted — returned to inventory"}]}
            : p);
        }
      }
      return {...state, parts, builds,
        sales: state.sales.map(s=>s.id===saleId?{...s,deleted:true,deletedAt:today(),returned:mode==="undo-and-return"||s.returned}:s)
      };
    }

    case "DELETE_PART": {
      const target=state.parts.find(p=>p.id===action.id);
      // A part inside an active build must be removed from that build first (dissolve, or
      // remove it from the build) before it can be deleted — otherwise the build's partIds
      // would point at a part that no longer exists, breaking its cost basis and profit math.
      if(target?.status==="in_build")return state;
      return {...state, parts: state.parts.filter(p=>p.id!==action.id)};
    }

    case "DUPLICATE_PART": {
      const src=state.parts.find(p=>p.id===action.id);
      if(!src)return state;
      const copy={...src,id:uid(),status:"available",soldTo:"",
        history:[{date:today(),event:`Duplicated from "${src.name}"`}]};
      return {...state, parts:[...state.parts,copy]};
    }

    case "DELETE_BUILD": {
      const {buildId,returnParts}=action;
      const build=state.builds.find(b=>b.id===buildId);
      return {...state,
        builds: state.builds.filter(b=>b.id!==buildId),
        parts: returnParts
          ? state.parts.map(p=>build?.partIds.includes(p.id)
              ? {...p,status:"available",history:[...p.history,{date:today(),event:`Build "${build.name}" deleted — returned to inventory`}]}
              : p)
          : state.parts.filter(p=>!build?.partIds.includes(p.id))
      };
    }

    // mode "parts-too" removes the bundle and every part that came from it.
    // mode "keep-loose" removes only the bundle record, leaving its parts in inventory as untracked single parts.
    case "DELETE_BUNDLE": {
      const {bundleId,mode}=action;
      if(mode==="parts-too"){
        return {...state,
          bundles: state.bundles.filter(b=>b.id!==bundleId),
          parts: state.parts.filter(p=>p.bundleId!==bundleId)
        };
      }
      return {...state,
        bundles: state.bundles.filter(b=>b.id!==bundleId),
        parts: state.parts.map(p=>p.bundleId===bundleId?{...p,bundleId:null,source:"Untracked (bundle deleted)"}:p)
      };
    }

    // Logs a capital loss and removes the part from active inventory, keeping a record in sales
    // (as a zero/negative-revenue "sale") so it still shows up in Dashboard/History analytics.
    case "MARK_DEFECTIVE": {
      const {id,reason}=action;
      const part=state.parts.find(p=>p.id===id);
      if(!part)return state;
      const loss={id:uid(),partId:part.id,name:part.name,cost:part.allocatedCost,salePrice:0,profit:-part.allocatedCost,
        buyerName:"",date:today(),writeOff:true,reason:reason||""};
      return {...state,
        sales:[...state.sales,loss],
        parts: state.parts.map(p=>p.id===id
          ? {...p,status:"defective",history:[...p.history,{date:today(),event:`Marked defective/write-off${reason?`: ${reason}`:""} — loss of ${fmt(part.allocatedCost)}`}]}
          : p)
      };
    }

    default: return state;
  }
}

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
function useToast() {
  const [toasts,setToasts] = useState([]);
  const toast = useCallback((message,type="success") => {
    const id=uid();
    setToasts(p=>[...p,{id,message,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3200);
  },[]);
  return {toasts,toast};
}
function ToastContainer({toasts}) {
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          background: t.type==="success"?"#14532d":t.type==="error"?"#7f1d1d":"#1e1b4b",
          border:`1px solid ${t.type==="success"?"#22c55e":t.type==="error"?"#ef4444":"#7c3aed"}`,
          color:"#fff",padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:500,
          maxWidth:300,animation:"slideIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",
          display:"flex",alignItems:"center",gap:8,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"
        }}>
          <span style={{fontSize:15}}>{t.type==="success"?"✓":t.type==="error"?"✕":"ℹ"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATED NUMBER
═══════════════════════════════════════════ */
function AnimNum({value}) {
  const [d,setD]=useState(0);
  const prev=useRef(0);
  useEffect(()=>{
    const start=prev.current,end=value,diff=end-start;
    if(!diff)return;
    let i=0;const steps=20;
    const t=setInterval(()=>{i++;setD(Math.round(start+(diff*i)/steps));if(i>=steps){clearInterval(t);prev.current=end;}},16);
    return()=>clearInterval(t);
  },[value]);
  return <>{d.toLocaleString("en-PH")}</>;
}

/* ═══════════════════════════════════════════
   BASE UI
═══════════════════════════════════════════ */
const SC = {
  available:{bg:"rgba(6,78,59,0.5)",border:"#16a34a",color:"#6ee7b7"},
  in_build:{bg:"rgba(12,74,110,0.5)",border:"#0ea5e9",color:"#7dd3fc"},
  sold:{bg:"rgba(39,39,42,0.5)",border:"#52525b",color:"#a1a1aa"},
  defective:{bg:"rgba(127,29,29,0.5)",border:"#ef4444",color:"#fca5a5"},
};
function Badge({s}) {
  const c=SC[s]||{};
  return <span style={{background:c.bg,border:`1px solid ${c.border}`,color:c.color,fontSize:10,padding:"2px 7px",borderRadius:6,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600,whiteSpace:"nowrap"}}>{s.replace("_"," ")}</span>;
}

/* ═══════════════════════════════════════════
   PHOTO UPLOAD — single image, upload from gallery
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   IMAGE COMPRESSION — resize before upload so phone photos (3-5MB)
   don't eat Railway disk space or slow down loading
═══════════════════════════════════════════ */
function compressImage(file,maxDimension=1280,quality=0.82){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read file"));
    reader.onload=()=>{
      img.onerror=()=>reject(new Error("Could not decode image"));
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDimension||height>maxDimension){
          if(width>height){height=Math.round(height*(maxDimension/width));width=maxDimension;}
          else{width=Math.round(width*(maxDimension/height));height=maxDimension;}
        }
        const canvas=document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        canvas.toBlob(blob=>{
          if(!blob){reject(new Error("Compression failed"));return;}
          resolve(new File([blob],file.name.replace(/\.(png|heic|heif)$/i,".jpg"),{type:"image/jpeg"}));
        },"image/jpeg",quality);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoUpload({photoUrl,photoRecordId,onChange,label="Photo"}) {
  const [status,setStatus]=useState("idle"); // idle | compressing | uploading | error
  const inputRef=useRef(null);

  const handleFile=async(file)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){setStatus("error");return;}
    setStatus("compressing");
    try{
      const compressed=await compressImage(file).catch(()=>file); // fall back to original if compression fails
      setStatus("uploading");
      const form=new FormData();
      form.append("photo",compressed);
      const res=await fetch("/photo",{method:"POST",body:form});
      if(!res.ok)throw new Error(`Upload failed (${res.status})`);
      const {url,recordId}=await res.json();
      // Clean up the old photo if one is being replaced — best effort, won't block the UI
      if(photoRecordId){fetch(`/photo/${photoRecordId}`,{method:"DELETE"}).catch(()=>{});}
      onChange({photoUrl:url,photoRecordId:recordId});
      setStatus("idle");
    }catch(err){
      console.error("Photo upload error:",err);
      setStatus("error");
    }
  };

  const removePhoto=()=>{
    if(photoRecordId){fetch(`/photo/${photoRecordId}`,{method:"DELETE"}).catch(()=>{});}
    onChange({photoUrl:"",photoRecordId:""});
  };

  return (
    <div>
      <div style={{fontSize:12,color:"#a1a1aa",marginBottom:5}}>{label}</div>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>handleFile(e.target.files?.[0])}/>
      {photoUrl?(
        <div style={{position:"relative",display:"inline-block"}}>
          <img src={photoUrl} alt="" style={{width:96,height:96,objectFit:"cover",borderRadius:10,border:"1px solid #3f3f46",display:"block"}}/>
          <button onClick={removePhoto} type="button" style={{position:"absolute",top:-7,right:-7,width:22,height:22,borderRadius:"50%",
            background:"#ef4444",border:"2px solid #18181b",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
        </div>
      ):(
        <button type="button" onClick={()=>inputRef.current?.click()} disabled={status==="uploading"||status==="compressing"}
          style={{width:96,height:96,borderRadius:10,border:"1.5px dashed #3f3f46",background:"#09090b",color:"#71717a",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:(status==="uploading"||status==="compressing")?"wait":"pointer",
            fontSize:11,transition:"border-color 0.15s,color 0.15s"}}
          onMouseEnter={e=>{if(status==="idle"){e.currentTarget.style.borderColor="#7c3aed";e.currentTarget.style.color="#a78bfa";}}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="#3f3f46";e.currentTarget.style.color="#71717a";}}>
          {status==="compressing"?(
            <><span style={{animation:"spin 0.6s linear infinite",fontSize:18,display:"inline-block"}}>⟳</span><span>Optimizing…</span></>
          ):status==="uploading"?(
            <><span style={{animation:"spin 0.6s linear infinite",fontSize:18,display:"inline-block"}}>⟳</span><span>Uploading…</span></>
          ):(
            <><span style={{fontSize:20}}>📷</span><span>Add photo</span></>
          )}
        </button>
      )}
      {status==="error"&&<div style={{color:"#f87171",fontSize:11,marginTop:5}}>Upload failed — try again</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DEFECTIVE MODAL — mark a part as defective/write-off, logs a capital loss
═══════════════════════════════════════════ */
function DefectiveModal({part,onConfirm,onCancel}) {
  const [reason,setReason]=useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8}}>Mark as defective?</div>
        <div style={{fontSize:13,color:"#a1a1aa",marginBottom:14,lineHeight:1.5}}>
          "{part.name}" will be removed from active inventory and logged as a capital loss of <b style={{color:"#fca5a5"}}>{fmt(part.allocatedCost)}</b> on your Dashboard.
        </div>
        <Inp label="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} placeholder="DOA, shorted during build, etc."/>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
          <Btn variant="warn" onClick={()=>onConfirm(reason)} style={{width:"100%"}}>Mark Defective — Log Loss</Btn>
          <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
function PhotoThumb({url,size=52,seed=0,onClick}) {
  if(!url)return null;
  // Deterministic slight tilt per item so the grid feels like a physical parts bin, not a uniform UI
  const tilt=((seed%5)-2)*1.6;
  return (
    <div onClick={onClick} style={{width:size,height:size,flexShrink:0,transform:`rotate(${tilt}deg)`,transition:"transform 0.2s",cursor:onClick?"pointer":"default"}}
      onMouseEnter={e=>e.currentTarget.style.transform=`rotate(0deg) scale(1.06)`}
      onMouseLeave={e=>e.currentTarget.style.transform=`rotate(${tilt}deg) scale(1)`}>
      <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:7,border:"2px solid #27272a",boxShadow:"0 3px 8px rgba(0,0,0,0.4)",display:"block"}}/>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LIGHTBOX — tap any photo to view full-screen
═══════════════════════════════════════════ */
function Lightbox({url,onClose}) {
  if(!url)return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeUp 0.15s ease"}} onClick={onClose}>
      <img src={url} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}/>
      <button onClick={onClose} style={{position:"absolute",top:18,right:18,width:36,height:36,borderRadius:"50%",
        background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:16,cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL — generic "are you sure?" with optional extra choices
═══════════════════════════════════════════ */
function ConfirmModal({title,message,confirmLabel="Delete",danger=true,onConfirm,onCancel,extraChoices}) {
  // extraChoices: optional array of {label, onClick, variant} rendered as additional buttons
  // (used for the bundle-delete and build-delete "what happens to the parts?" choices)
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:"#a1a1aa",marginBottom:18,lineHeight:1.5}}>{message}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {extraChoices?extraChoices.map((c,i)=>(
            <Btn key={i} variant={c.variant||"warn"} onClick={c.onClick} style={{width:"100%"}}>{c.label}</Btn>
          )):(
            <Btn variant={danger?"danger":"primary"} onClick={onConfirm} style={{width:"100%"}}>{confirmLabel}</Btn>
          )}
          <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

function Card({children,style={}}) {
  const [v,setV]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setV(true),30);return()=>clearTimeout(t);},[]);
  return <div style={{background:"#18181b",border:"1px solid #27272a",borderRadius:14,padding:18,transition:"opacity 0.25s,transform 0.25s",opacity:v?1:0,transform:v?"translateY(0)":"translateY(8px)",...style}}>{children}</div>;
}

function Btn({children,variant="primary",onClick,disabled=false,loading=false,small=false,style={}}) {
  const [pressed,setPressed]=useState(false);
  const VC={
    primary:{bg:"#7c3aed",hov:"#6d28d9",txt:"#fff",bdr:"transparent"},
    ghost:{bg:"#27272a",hov:"#3f3f46",txt:"#d4d4d8",bdr:"#3f3f46"},
    danger:{bg:"rgba(127,29,29,0.5)",hov:"#991b1b",txt:"#fca5a5",bdr:"#ef4444"},
    success:{bg:"#15803d",hov:"#166534",txt:"#fff",bdr:"transparent"},
    warn:{bg:"rgba(120,53,15,0.5)",hov:"#92400e",txt:"#fcd34d",bdr:"#f59e0b"},
  };
  const c=VC[variant]||VC.primary;
  return (
    <button
      onClick={()=>{if(!disabled&&!loading){setPressed(true);setTimeout(()=>setPressed(false),100);onClick&&onClick();}}}
      disabled={disabled||loading}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=c.hov;}}
      onMouseLeave={e=>{e.currentTarget.style.background=c.bg;}}
      style={{background:c.bg,color:disabled?"#52525b":c.txt,border:`1px solid ${c.bdr}`,borderRadius:9,
        padding:small?"5px 10px":"8px 16px",fontSize:small?11:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",
        transition:"all 0.1s",transform:pressed?"scale(0.95)":"scale(1)",opacity:disabled?0.5:1,
        display:"inline-flex",alignItems:"center",gap:5,...style}}>
      {loading&&<span style={{animation:"spin 0.6s linear infinite",display:"inline-block"}}>⟳</span>}
      {children}
    </button>
  );
}

function Inp({label,error,...props}) {
  const [f,setF]=useState(false);
  // Centralized guard for numeric fields: strips a leading "-" so typing, pasting, or scrolling
  // can't produce a negative cost/price/margin anywhere in the app. Applied here once rather than
  // per call site, since `min="0"` alone only affects the spinner UI, not typed or pasted input.
  const handleChange=props.type==="number"&&props.onChange
    ? (e)=>{
        if(e.target.value.startsWith("-")){e.target.value=e.target.value.replace(/^-+/,"");}
        props.onChange(e);
      }
    : props.onChange;
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:"#a1a1aa"}}>
      {label}
      <input {...props} onChange={handleChange} min={props.type==="number"?(props.min??0):props.min}
        onFocus={e=>{setF(true);props.onFocus?.(e);}} onBlur={e=>{setF(false);props.onBlur?.(e);}}
        style={{background:"#27272a",border:`1px solid ${error?"#ef4444":f?"#7c3aed":"#3f3f46"}`,borderRadius:9,
          padding:"8px 11px",color:"#fff",fontSize:13,outline:"none",
          boxShadow:f?"0 0 0 3px rgba(124,58,237,0.15)":"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",...(props.style||{})}} />
      {error&&<span style={{color:"#f87171",fontSize:11}}>{error}</span>}
    </label>
  );
}

function Sel({label,children,style,...props}) {
  const [f,setF]=useState(false);
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:"#a1a1aa"}}>
      {label}
      <select {...props} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{background:"#27272a",border:`1px solid ${f?"#7c3aed":"#3f3f46"}`,borderRadius:9,
          padding:"8px 11px",color:"#fff",fontSize:13,outline:"none",
          boxShadow:f?"0 0 0 3px rgba(124,58,237,0.15)":"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",...style}}>
        {children}
      </select>
    </label>
  );
}

/* ═══════════════════════════════════════════
   CATEGORY PICKER — built-in PC categories + any custom categories the user has added,
   with a "+ Add Category" entry that opens an inline name + domain (PC Part / General Asset) form.
   This is the Domain Firewall's front door: every category gets a domain at creation time.
═══════════════════════════════════════════ */
function CategoryPicker({label,value,onChange,customCategories,dispatch,style}) {
  const [adding,setAdding]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDomain,setNewDomain]=useState("pc_part");

  const handleSelect=(e)=>{
    if(e.target.value==="__add__"){setAdding(true);return;}
    onChange(e.target.value);
  };

  const confirmAdd=()=>{
    const name=newName.trim();
    if(!name)return;
    dispatch({type:"ADD_CATEGORY",name,domain:newDomain});
    onChange(name);
    setAdding(false);setNewName("");setNewDomain("pc_part");
  };

  if(adding){
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8,padding:11,background:"#09090b",border:"1px solid #3f3f46",borderRadius:9,...style}}>
        <div style={{fontSize:12,color:"#a1a1aa"}}>New category name</div>
        <Inp label="" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Smartphone, Vehicle, Peripheral"/>
        <div style={{fontSize:12,color:"#a1a1aa",marginTop:2}}>What kind of item is this?</div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setNewDomain("pc_part")} style={{flex:1,padding:"8px 10px",borderRadius:8,fontSize:12,cursor:"pointer",
            border:`1.5px solid ${newDomain==="pc_part"?"#7c3aed":"#3f3f46"}`,background:newDomain==="pc_part"?"rgba(124,58,237,0.12)":"transparent",
            color:newDomain==="pc_part"?"#a78bfa":"#a1a1aa"}}>🖥️ PC Part<div style={{fontSize:10,opacity:0.7,marginTop:2}}>Usable in Builds</div></button>
          <button onClick={()=>setNewDomain("general_asset")} style={{flex:1,padding:"8px 10px",borderRadius:8,fontSize:12,cursor:"pointer",
            border:`1.5px solid ${newDomain==="general_asset"?"#7c3aed":"#3f3f46"}`,background:newDomain==="general_asset"?"rgba(124,58,237,0.12)":"transparent",
            color:newDomain==="general_asset"?"#a78bfa":"#a1a1aa"}}>📦 General Asset<div style={{fontSize:10,opacity:0.7,marginTop:2}}>Not for PC builds</div></button>
        </div>
        <div style={{display:"flex",gap:7,marginTop:2}}>
          <Btn small onClick={confirmAdd} disabled={!newName.trim()} style={{flex:1}}>Add Category</Btn>
          <Btn small variant="ghost" onClick={()=>{setAdding(false);setNewName("");}}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <Sel label={label} value={value} onChange={handleSelect} style={style}>
      <optgroup label="PC Parts">
        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        {(customCategories||[]).filter(c=>c.domain==="pc_part").map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
      </optgroup>
      {(customCategories||[]).some(c=>c.domain==="general_asset")&&(
        <optgroup label="General Assets">
          {(customCategories||[]).filter(c=>c.domain==="general_asset").map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
        </optgroup>
      )}
      <option value="__add__">+ Add Category...</option>
    </Sel>
  );
}

function StatBox({label,value,sub,color}) {
  return (
    <Card>
      <div style={{fontSize:10,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{label}</div>
      <div style={{fontSize:21,fontWeight:700,fontFamily:"monospace",color:color||"#fff"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#71717a",marginTop:3}}>{sub}</div>}
    </Card>
  );
}

function DealBar({score}) {
  const [w,setW]=useState(0);
  useEffect(()=>{setTimeout(()=>setW(Math.min(score/2,1)*100),60);},[score]);
  const col=score>=1.3?"#22c55e":score>=1?"#eab308":"#ef4444";
  const lbl=score>=1.3?"🔥 Great":score>=1?"👍 Fair":"⚠️ Overpaid";
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:12,color:"#a1a1aa"}}>Deal score</span>
        <span style={{fontSize:12,fontWeight:700,color:col,fontFamily:"monospace"}}>{score.toFixed(3)} — {lbl}</span>
      </div>
      <div style={{height:5,background:"#3f3f46",borderRadius:99}}>
        <div style={{height:"100%",width:`${w}%`,background:col,borderRadius:99,transition:"width 0.6s cubic-bezier(0.34,1.2,0.64,1)"}}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   QUICK SELL MODAL  (#1)
═══════════════════════════════════════════ */
function QuickSellModal({part,onClose,onConfirm,targetMargin}) {
  const suggested = Math.round(part.allocatedCost * (1 + targetMargin/100));
  const [price,setPrice]=useState(String(suggested));
  const [buyer,setBuyer]=useState("");
  const sp=parseFloat(price)||0;
  const profit=sp-part.allocatedCost;
  const m=part.allocatedCost>0?profit/part.allocatedCost:0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:24,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>Quick Sell</div>
        <div style={{fontSize:13,color:"#71717a",marginBottom:16}}>{part.name} · cost {fmt(part.allocatedCost)}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label={`Sale price (₱) — suggested ${fmt(suggested)} at ${targetMargin}% margin`} type="number" value={price} onChange={e=>setPrice(e.target.value)} />
          <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz" />
          {sp>0&&(
            <div style={{background:"#09090b",borderRadius:9,padding:12,border:"1px solid #27272a"}}>
              {[["Profit",`${profit>=0?"+":""}${fmt(profit)}`,profit>=0?"#34d399":"#f87171"],
                ["Margin",pct(m),profit>=0?"#34d399":"#f87171"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:"#a1a1aa"}}>{l}</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn variant="success" onClick={()=>onConfirm(sp,buyer)} disabled={!sp} style={{flex:1}}>Confirm Sale</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EDIT PART MODAL  (#2)
═══════════════════════════════════════════ */
function EditPartModal({part,onClose,onSave,dispatch,customCategories}) {
  const [name,setName]=useState(part.name);
  const [cat,setCat]=useState(part.category);
  const [cost,setCost]=useState(String(part.allocatedCost));
  const [market,setMarket]=useState(String(part.marketValue));
  const [notes,setNotes]=useState(part.notes||"");
  const [photo,setPhoto]=useState({photoUrl:part.photoUrl||"",photoRecordId:part.photoRecordId||""});
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:24,width:"100%",maxWidth:420,animation:"fadeUp 0.2s ease",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:16}}>Edit Part</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <PhotoUpload label="Photo" photoUrl={photo.photoUrl} photoRecordId={photo.photoRecordId} onChange={setPhoto}/>
          <Inp label="Name" value={name} onChange={e=>setName(e.target.value)}/>
          <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={customCategories} dispatch={dispatch}/>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Cost (₱)" type="number" value={cost} onChange={e=>setCost(e.target.value)}/>
            <Inp label="Market value (₱)" type="number" value={market} onChange={e=>setMarket(e.target.value)}/>
          </div>
          <Inp label="Notes (condition, extras, etc.)" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tested working, fan slightly loud"/>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn onClick={()=>onSave({name,category:cat,allocatedCost:parseFloat(cost)||part.allocatedCost,marketValue:parseFloat(market)||part.marketValue,notes,photoUrl:photo.photoUrl,photoRecordId:photo.photoRecordId},`cost→${fmt(parseFloat(cost)||part.allocatedCost)}`)} style={{flex:1}}>Save Changes</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   WALLET MODALS (Transfer & Expense)
═══════════════════════════════════════════ */
function TransferModal({onClose, dispatch, toast, businessCash, personalCash}) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("to_personal");

  const handleTransfer = () => {
    const amt = parseFloat(amount);
    if(!amt || amt <= 0) return toast("Enter a valid amount", "error");
    if(direction === "to_personal" && amt > businessCash) return toast("Insufficient business funds", "error");
    if(direction === "to_business" && amt > personalCash) return toast("Insufficient personal funds", "error");

    dispatch({type: "TRANSFER_FUNDS", amount: amt, direction});
    toast(`Transferred ${fmt(amt)} to ${direction === "to_personal" ? "Personal Wallet" : "Business Wallet"} ✓`);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:16}}>Transfer Funds</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <Btn variant={direction==="to_personal"?"primary":"ghost"} onClick={()=>setDirection("to_personal")} style={{flex:1}}>To Personal</Btn>
          <Btn variant={direction==="to_business"?"primary":"ghost"} onClick={()=>setDirection("to_business")} style={{flex:1}}>To Business</Btn>
        </div>
        <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
        <div style={{marginTop:16, display:"flex", gap:8}}>
          <Btn variant="success" onClick={handleTransfer} style={{flex:1}}>Confirm Transfer</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD  (#6 capital at risk, #7 bundle P&L)
═══════════════════════════════════════════ */
function Dashboard({state,dispatch,toast,setTab,openLightbox}) {
  const [addingExpense,setAddingExpense]=useState(false);
  const [transferring,setTransferring]=useState(false);
  const {parts,bundles}=state;
  // Deleted sale records are kept (soft-delete, for the "Deleted records" filter in History) but
  // must never count toward live profit/revenue. Returned sales ARE deleted from active totals too —
  // a returned sale means the money didn't actually stay made.
  const sales=state.sales.filter(s=>!s.deleted&&!s.returned);
  
  // ══════════════════════════════════════════════════════════════════════════════
  // CORE INVENTORY VALUATION METRICS
  // ══════════════════════════════════════════════════════════════════════════════
  
  // 1. Inventory Market Value: current selling price of unsold items. Fallback to cost if market value is missing.
  const activeInventory=parts.filter(p=>p.status==="available"||p.status==="in_build");
  const inventoryMarketValue=activeInventory.reduce((s,p)=>{
    const mkt=p.marketValue||0;
    return s+(mkt>0?mkt:p.allocatedCost); // fallback to cost if market value is blank/zero
  },0);
  
  // 2. Inventory Cost: total money we've spent acquiring everything still in stock.
  const inventoryCost=activeInventory.reduce((s,p)=>s+p.allocatedCost,0);
  
  // 3. Recovered Capital: money we've successfully pulled back from completed sales.
  const recoveredCapital=sales.reduce((s,x)=>s+x.salePrice,0);
  
  // 4. Cash on Hand: business wallet balance for buying/selling parts.
  const cashOnHand=state.businessCash||0;
  const personalCash=state.personalCash||0;
  
  // Funds to Recover: sum of personal draws (owner's money taken out, not business expense).
  const fundsToRecover=(state.expenses||[])
    .filter(e=>e.type==="personal_draw")
    .reduce((s,e)=>s+e.amount,0);
  
  // Alert trigger: if we've dropped below the target baseline due to draws/spending.
  const isUnderCapital=cashOnHand<14500;
  
  // ══════════════════════════════════════════════════════════════════════════════
  // Traditional profit/loss metrics (unchanged)
  // ══════════════════════════════════════════════════════════════════════════════
  
  const totalCapital=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const totalRevenue=sales.reduce((s,x)=>s+x.salePrice,0);
  const totalCOGS=sales.reduce((s,x)=>s+x.cost,0);
  const totalProfit=totalRevenue-totalCOGS;
  const roi=totalCOGS>0?totalProfit/totalCOGS:0;
  // Defective parts are a realized loss already counted in totalProfit (via their write-off sale),
  // so they're excluded from "at risk" — that stat is only for capital still tied up in active inventory.
  const atRisk=parts.filter(p=>p.status!=="sold"&&p.status!=="defective").reduce((s,p)=>s+p.allocatedCost,0);
  const recoveredCost=parts.filter(p=>p.status==="sold").reduce((s,p)=>s+p.allocatedCost,0);
  const writeOffLoss=sales.filter(s=>s.writeOff).reduce((s,x)=>s+Math.abs(x.profit),0);
  const writeOffCount=parts.filter(p=>p.status==="defective").length;
  const available=parts.filter(p=>p.status==="available").length;
  const inBuild=parts.filter(p=>p.status==="in_build").length;
  const sold=parts.filter(p=>p.status==="sold").length;
  const recentSales=[...sales].reverse().slice(0,5);

  // Bundle P&L  (#7)
  const bundlePnl = bundles.map(b=>{
    const bParts=parts.filter(p=>p.bundleId===b.id);
    const soldParts=bParts.filter(p=>p.status==="sold");
    const unsoldParts=bParts.filter(p=>p.status!=="sold");
    const recovered=soldParts.reduce((s,p)=>{
      const sale=sales.find(s=>s.partId===p.id)||sales.find(s=>s.name===p.name);
      return s+(sale?sale.salePrice:0);
    },0);
    const unsoldMarket=unsoldParts.reduce((s,p)=>s+p.marketValue,0);
    return {...b,bParts,soldParts,unsoldParts,recovered,unsoldMarket};
  });

  // Insight: profit by category — which part types are actually worth buying
  const categoryProfit = {};
  sales.forEach(s=>{
    const part=parts.find(p=>p.name===s.name);
    const cat=part?.category||"Other";
    if(!categoryProfit[cat])categoryProfit[cat]={profit:0,count:0};
    categoryProfit[cat].profit+=s.profit;
    categoryProfit[cat].count+=1;
  });
  const categoryRows=Object.entries(categoryProfit).sort((a,b)=>b[1].profit-a[1].profit);
  const maxCatProfit=Math.max(1,...categoryRows.map(([,v])=>Math.abs(v.profit)));

  // Insight: cumulative profit sparkline over sale sequence
  let running=0;
  const cumPoints=sales.map(s=>{running+=s.profit;return running;});
  const sparkMax=Math.max(1,...cumPoints.map(Math.abs));
  const sparkPath=cumPoints.length>1?cumPoints.map((v,i)=>{
    const x=(i/(cumPoints.length-1))*100;
    const y=50-(v/sparkMax)*45;
    return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" "):"";

  // Insight: average days held before sale — flags whether inventory is moving or going stale
  const holdDurations=[];
  parts.filter(p=>p.status==="sold").forEach(p=>{
    const sale=sales.find(s=>s.partId===p.id)||sales.find(s=>s.name===p.name);
    const bought=p.history?.[0]?.date;
    if(sale&&bought){
      const d1=new Date(bought).getTime(),d2=new Date(sale.date).getTime();
      if(!isNaN(d1)&&!isNaN(d2)){
        const days=Math.max(0,Math.round((d2-d1)/86400000));
        holdDurations.push(days);
      }
    }
  });
  const avgDaysToSell=holdDurations.length?Math.round(holdDurations.reduce((s,d)=>s+d,0)/holdDurations.length):null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {addingExpense&&<AddExpenseModal dispatch={dispatch} toast={toast} onClose={()=>setAddingExpense(false)}/>}
      {transferring&&<TransferModal dispatch={dispatch} toast={toast} onClose={()=>setTransferring(false)} businessCash={cashOnHand} personalCash={personalCash}/>}
      
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Overview</h2>
          <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Live figures from your inventory.</p>
        </div>
        <div style={{display:"flex", gap:8}}>
          <Btn small variant="ghost" onClick={()=>setTransferring(true)}>⇆ Transfer</Btn>
          <Btn small variant="ghost" onClick={()=>setAddingExpense(true)}>+ Expense</Btn>
        </div>
      </div>

      {/* Liquidity Waterfall — paper profit can hide a cash crunch: you can show ₱50k profit
          and still have ₱0 in your wallet if it's all sitting in unsold inventory. This makes
          that visible at a glance. Kept alongside (not replacing) the profit/ROI stats below,
          since those answer a different question — "am I profitable" vs "am I liquid" — and
          both matter for a healthy flipping business. */}
      <Card>
        <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Liquidity</div>
        <div style={{fontSize:11,color:"#52525b",marginBottom:16}}>Where your capital actually is right now</div>
        {(()=>{
          const maxVal=Math.max(totalCapital,atRisk,totalRevenue,1);
          const barH=v=>Math.max(4,Math.round((v/maxVal)*120));
          const bars=[
            {label:"Deployed",sub:"ever spent buying",value:totalCapital,color:"#ef4444"},
            {label:"Locked",sub:"sitting unsold",value:atRisk,color:"#f59e0b"},
            {label:"Recovered",sub:"cash back from sales",value:totalRevenue,color:"#22c55e"},
          ];
          const lockedRatio=totalCapital>0?atRisk/totalCapital:0;
          return (
            <>
              <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-end",height:150,marginBottom:8}}>
                {bars.map(b=>(
                  <div key={b.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"30%"}}>
                    <div style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{fmt(b.value)}</div>
                    <div style={{width:"100%",maxWidth:64,height:barH(b.value),background:b.color,borderRadius:"6px 6px 2px 2px",
                      transition:"height 0.6s cubic-bezier(0.34,1.2,0.64,1)",boxShadow:`0 0 14px ${b.color}55`}}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-around",marginBottom:lockedRatio>0.5?12:0}}>
                {bars.map(b=>(
                  <div key={b.label} style={{width:"30%",textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#d4d4d8",fontWeight:600}}>{b.label}</div>
                    <div style={{fontSize:10,color:"#52525b"}}>{b.sub}</div>
                  </div>
                ))}
              </div>
              {lockedRatio>0.5&&(
                <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:9,padding:"9px 12px",fontSize:12,color:"#fbbf24"}}>
                  ⚠️ {pct(lockedRatio)} of everything you've ever spent is still sitting unsold. Consider moving some inventory to free up cash.
                </div>
              )}
            </>
          );
        })()}
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        <StatBox label="Total Profit" value={fmt(totalProfit)} color={totalProfit>=0?"#34d399":"#f87171"} sub={`ROI ${pct(roi)}`}/>
        <StatBox label="Total Revenue" value={fmt(totalRevenue)} color="#34d399"/>
        <StatBox label="Capital at Risk" value={fmt(atRisk)} color="#f59e0b" sub="locked in unsold parts"/>
        <StatBox label="Capital Recovered" value={fmt(recoveredCost)} sub={`${parts.length>0?Math.round(recoveredCost/totalCapital*100):0}% of total`}/>
        {avgDaysToSell!==null&&<StatBox label="Avg. Days to Sell" value={`${avgDaysToSell}d`} color="#38bdf8" sub={`across ${holdDurations.length} sold part${holdDurations.length===1?"":"s"}`}/>}
        {writeOffCount>0&&<StatBox label="Write-offs" value={fmt(-writeOffLoss)} color="#f87171" sub={`${writeOffCount} defective part${writeOffCount===1?"":"s"}`}/>}
      </div>

      {/* Capital at risk bar  (#6) */}
      {totalCapital>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",marginBottom:8}}>CAPITAL RECOVERY</div>
          <div style={{height:8,background:"#27272a",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(recoveredCost/totalCapital*100,100)}%`,background:"linear-gradient(90deg,#7c3aed,#34d399)",borderRadius:99,transition:"width 0.8s cubic-bezier(0.34,1.2,0.64,1)"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:"#71717a"}}>
            <span>Recovered {fmt(recoveredCost)}</span><span>Total {fmt(totalCapital)}</span>
          </div>
        </Card>
      )}

      {/* CORE VALUATION METRICS — answers the real question: "What's my actual liquid position right now?" */}
      <Card>
        <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Core Inventory & Cash Position</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:"#a1a1aa",marginBottom:2}}>Market Value (Inventory)</div>
            <div style={{fontSize:16,fontWeight:700,color:"#d4d4d8",fontFamily:"monospace"}}>{fmt(inventoryMarketValue)}</div>
            <div style={{fontSize:9,color:"#52525b",marginTop:2}}>unsold items @ current price</div>
          </div>
          <div>
            <div style={{fontSize:10,color:"#a1a1aa",marginBottom:2}}>Cost Basis (Locked Capital)</div>
            <div style={{fontSize:16,fontWeight:700,color:"#d4d4d8",fontFamily:"monospace"}}>{fmt(inventoryCost)}</div>
            <div style={{fontSize:9,color:"#52525b",marginTop:2}}>what we spent</div>
          </div>
          <div>
            <div style={{fontSize:10,color:"#a1a1aa",marginBottom:2}}>Recovered from Sales</div>
            <div style={{fontSize:16,fontWeight:700,color:"#34d399",fontFamily:"monospace"}}>{fmt(recoveredCapital)}</div>
            <div style={{fontSize:9,color:"#52525b",marginTop:2}}>cash actually collected</div>
          </div>
          <div style={{gridColumn:"1 / -1", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div style={{background:isUnderCapital?"rgba(239,68,68,0.08)":"#09090b",border:`1px solid ${isUnderCapital?"#7f1d1d":"#27272a"}`,borderRadius:9,padding:11}}>
              <div style={{fontSize:10,color:"#a1a1aa",marginBottom:2}}>Business Wallet</div>
              <div style={{fontSize:16,fontWeight:700,color:isUnderCapital?"#f87171":"#34d399",fontFamily:"monospace"}}>{fmt(cashOnHand)}</div>
              <div style={{fontSize:9,color:"#52525b",marginTop:2}}>for parts & builds</div>
            </div>
            
            <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:9,padding:11}}>
              <div style={{fontSize:10,color:"#a1a1aa",marginBottom:2}}>Personal Wallet</div>
              <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>{fmt(personalCash)}</div>
              <div style={{fontSize:9,color:"#52525b",marginTop:2}}>your actual pocket money</div>
            </div>
          </div>
        </div>

        {/* Funds to Recover Alert */}
        {isUnderCapital&&(
          <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:9,padding:12}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <span style={{fontSize:16}}>⚠️</span>
              <div>
                <div style={{color:"#fbbf24",fontWeight:600,fontSize:12,marginBottom:2}}>Below Target Baseline</div>
                <div style={{color:"#d4d4d8",fontSize:11,lineHeight:1.4}}>
                  Your liquid cash ({fmt(cashOnHand)}) has dropped below your ₱14,500 target.
                  {fundsToRecover>0&&<div style={{marginTop:4}}>Personal draws to recover: <strong style={{color:"#fbbf24"}}>{fmt(fundsToRecover)}</strong></div>}
                  Consider pausing new purchases or raising prices to rebuild your war chest.
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[["Available","#34d399",available],["In Builds","#38bdf8",inBuild],["Sold","#71717a",sold]].map(([l,c,v])=>(
          <Card key={l}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:30,fontWeight:800,color:c,fontFamily:"monospace"}}><AnimNum value={v}/></div>
              <div style={{fontSize:10,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginTop:4}}>{l}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Notes — jotted from the floating [+] button's Note action */}
      {(state.quickNotes||[]).length>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Quick Notes</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[...state.quickNotes].reverse().map(n=>(
              <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,
                background:"#09090b",border:"1px solid #27272a",borderRadius:9,padding:"9px 11px"}}>
                <div style={{minWidth:0}}>
                  <div style={{color:"#d4d4d8",fontSize:13,lineHeight:1.4,whiteSpace:"pre-wrap"}}>{n.text}</div>
                  <div style={{color:"#52525b",fontSize:10,marginTop:4}}>{n.date}</div>
                </div>
                <button onClick={()=>dispatch({type:"DELETE_QUICK_NOTE",id:n.id})}
                  style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:14,padding:"2px 4px",flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Insight: cumulative profit sparkline */}
      {cumPoints.length>1&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
            <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em"}}>Profit Trend</div>
            <div style={{fontSize:11,color:totalProfit>=0?"#34d399":"#f87171",fontFamily:"monospace"}}>{totalProfit>=0?"+":""}{fmt(totalProfit)} all-time</div>
          </div>
          <svg viewBox="0 0 100 50" style={{width:"100%",height:60,display:"block"}} preserveAspectRatio="none">
            <line x1="0" y1="25" x2="100" y2="25" stroke="#27272a" strokeWidth="0.5"/>
            <path d={sparkPath} fill="none" stroke={totalProfit>=0?"#34d399":"#f87171"} strokeWidth="2" vectorEffect="non-scaling-stroke"
              style={{filter:`drop-shadow(0 0 4px ${totalProfit>=0?"rgba(52,211,153,0.4)":"rgba(248,113,113,0.4)"})`}}/>
          </svg>
          <div style={{fontSize:10,color:"#52525b",marginTop:2}}>Running profit across {sales.length} sale{sales.length===1?"":"s"}, in order</div>
        </Card>
      )}

      {/* Insight: profit by category */}
      {categoryRows.length>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Most Profitable Categories</div>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {categoryRows.map(([cat,v])=>{
              const w=Math.abs(v.profit)/maxCatProfit*100;
              const positive=v.profit>=0;
              return (
                <div key={cat}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:"#d4d4d8"}}>{cat} <span style={{color:"#52525b"}}>({v.count} sold)</span></span>
                    <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:positive?"#34d399":"#f87171"}}>{positive?"+":""}{fmt(v.profit)}</span>
                  </div>
                  <div style={{height:5,background:"#27272a",borderRadius:99}}>
                    <div style={{height:"100%",width:`${w}%`,background:positive?"#22c55e":"#ef4444",borderRadius:99,transition:"width 0.7s cubic-bezier(0.34,1.2,0.64,1)"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Bundle P&L  (#7) */}
      {bundlePnl.length>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Bundle Recovery</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {bundlePnl.map(b=>{
              const recPct=b.purchasePrice>0?Math.min(b.recovered/b.purchasePrice*100,100):0;
              return (
                <div key={b.id}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,color:"#d4d4d8",fontWeight:500}}>{b.name}</span>
                    <span style={{fontSize:12,color:"#71717a",fontFamily:"monospace"}}>{fmt(b.recovered)} / {fmt(b.purchasePrice)}</span>
                  </div>
                  <div style={{height:5,background:"#27272a",borderRadius:99}}>
                    <div style={{height:"100%",width:`${recPct}%`,background:recPct>=100?"#22c55e":"#7c3aed",borderRadius:99,transition:"width 0.8s ease"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#52525b",marginTop:3}}>
                    {b.soldParts.length}/{b.bParts.length} parts sold · {b.unsoldParts.length} remaining ~{fmt(b.unsoldMarket)} market
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {recentSales.length>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Recent Sales</div>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {recentSales.map(s=>{
              const profit=s.salePrice-s.cost;
              return (
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"#fff",fontSize:13,fontWeight:500}}>{s.name}</div>
                    <div style={{color:"#71717a",fontSize:10}}>{s.date}{s.buyerName?` · ${s.buyerName}`:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"monospace",fontSize:13,color:"#fff"}}>{fmt(s.salePrice)}</div>
                    <div style={{fontFamily:"monospace",fontSize:11,color:profit>=0?"#34d399":"#f87171"}}>{profit>=0?"+":""}{fmt(profit)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {parts.length===0&&(
        <Card style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:48,marginBottom:12}}>🖥️</div>
          <div style={{color:"#d4d4d8",fontWeight:600}}>No parts yet</div>
          <div style={{color:"#52525b",fontSize:13,marginTop:6}}>Go to Buy → add your first bundle.</div>
          <div style={{marginTop:16}}><Btn onClick={()=>setTab("Buy")}>Start Buying</Btn></div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BUY
═══════════════════════════════════════════ */
function Buy({state,dispatch,toast}) {
  const [mode,setMode]=useState("bundle");
  const [bundleName,setBundleName]=useState("");
  const [purchasePrice,setPurchasePrice]=useState("");
  const [bundlePhoto,setBundlePhoto]=useState({photoUrl:"",photoRecordId:""});
  const [partRows,setPartRows]=useState([{id:uid(),name:"",category:"GPU",marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
  const [singleName,setSingleName]=useState("");
  const [singleCat,setSingleCat]=useState("GPU");
  const [singleCost,setSingleCost]=useState("");
  const [singleMarket,setSingleMarket]=useState("");
  const [singleNotes,setSingleNotes]=useState("");
  const [singlePhoto,setSinglePhoto]=useState({photoUrl:"",photoRecordId:""});
  const [loading,setLoading]=useState(false);

  const totalMarket=partRows.reduce((s,r)=>s+(parseFloat(r.marketValue)||0),0);
  const paid=parseFloat(purchasePrice)||0;
  const dealScore=paid>0&&totalMarket>0?totalMarket/paid:null;

  const addRow=()=>setPartRows(p=>[...p,{id:uid(),name:"",category:"GPU",marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
  const removeRow=id=>setPartRows(p=>p.filter(r=>r.id!==id));
  const updateRow=(id,field,val)=>setPartRows(p=>p.map(r=>r.id===id?{...r,[field]:val}:r));

  // Speed feature: duplicate the most recent bundle's structure (names/categories) so
  // re-buying a similar batch doesn't mean re-typing everything from scratch.
  const duplicateLastBundle=()=>{
    const last=state.bundles[state.bundles.length-1];
    if(!last)return;
    const lastParts=state.parts.filter(p=>p.bundleId===last.id);
    setBundleName(last.name);
    setPartRows(lastParts.length?lastParts.map(p=>({id:uid(),name:p.name,category:p.category,marketValue:"",notes:"",photoUrl:"",photoRecordId:""})):[{id:uid(),name:"",category:"GPU",marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
    toast(`Loaded structure from "${last.name}" — update prices ✓`);
  };

  const submitBundle=()=>{
    if(!bundleName||!purchasePrice||totalMarket===0){toast("Fill all fields and add part values","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const bundleId=uid();
      const num=state.bundles.length+1;
      const src=`Bundle #${String(num).padStart(3,"0")} — ${bundleName}`;
      const newParts=partRows.filter(r=>r.name&&r.marketValue).map(r=>{
        const mv=parseFloat(r.marketValue);
        const share=mv/totalMarket;
        const alloc=share*paid;
        return {id:uid(),name:r.name,category:r.category,marketValue:mv,allocatedCost:alloc,
          source:src,bundleId,status:"available",notes:r.notes||"",soldTo:"",
          photoUrl:r.photoUrl||"",photoRecordId:r.photoRecordId||"",
          history:[{date:today(),event:`Bought via ${src} — allocated ${fmt(alloc)}`}]};
      });
      dispatch({type:"ADD_BUNDLE",bundle:{id:bundleId,name:bundleName,purchasePrice:paid,totalMarket,date:today(),
        photoUrl:bundlePhoto.photoUrl,photoRecordId:bundlePhoto.photoRecordId},parts:newParts});
      toast(`Bundle added — ${newParts.length} parts in inventory ✓`);
      setBundleName("");setPurchasePrice("");setPartRows([{id:uid(),name:"",category:"GPU",marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
      setBundlePhoto({photoUrl:"",photoRecordId:""});
      setLoading(false);
    },400);
  };

  const submitSingle=()=>{
    if(!singleName||!singleCost){toast("Enter name and cost","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const cost=parseFloat(singleCost);
      const market=parseFloat(singleMarket)||cost;
      dispatch({type:"ADD_PARTS",parts:[{id:uid(),name:singleName,category:singleCat,marketValue:market,
        allocatedCost:cost,source:"Direct purchase",bundleId:null,status:"available",notes:singleNotes,soldTo:"",
        photoUrl:singlePhoto.photoUrl,photoRecordId:singlePhoto.photoRecordId,
        history:[{date:today(),event:`Bought for ${fmt(cost)}`}]}]});
      toast(`${singleName} added ✓`);
      setSingleName("");setSingleCost("");setSingleMarket("");setSingleNotes("");setSingleCat("GPU");
      setSinglePhoto({photoUrl:"",photoRecordId:""});
      setLoading(false);
    },300);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Buy Parts</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Add a bundle PC or individual part.</p></div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant={mode==="bundle"?"primary":"ghost"} onClick={()=>setMode("bundle")}>Bundle PC</Btn>
        <Btn variant={mode==="single"?"primary":"ghost"} onClick={()=>setMode("single")}>Single Part</Btn>
      </div>

      {mode==="bundle"&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8"}}>Bundle Details</div>
            {state.bundles.length>0&&(
              <button onClick={duplicateLastBundle} style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:11.5,fontWeight:600,padding:0}}
                onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#7c3aed"}>↻ Duplicate last bundle</button>
            )}
          </div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Bundle photo (optional)" photoUrl={bundlePhoto.photoUrl} photoRecordId={bundlePhoto.photoRecordId} onChange={setBundlePhoto}/>
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
            <Inp label="Source / seller" value={bundleName} onChange={e=>setBundleName(e.target.value)} placeholder="FB Marketplace – Juan"/>
            <Inp label="You paid (₱)" type="number" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} placeholder="8000"/>
          </div>
          <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:10}}>Parts — enter estimated market value</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {partRows.map((row,idx)=>(
              <div key={row.id} style={{display:"flex",gap:10,alignItems:"flex-start",animation:"fadeUp 0.15s ease",paddingBottom:12,borderBottom:idx<partRows.length-1?"1px solid #1f1f23":"none"}}>
                <PhotoUpload label="" photoUrl={row.photoUrl} photoRecordId={row.photoRecordId} onChange={({photoUrl,photoRecordId})=>{updateRow(row.id,"photoUrl",photoUrl);updateRow(row.id,"photoRecordId",photoRecordId);}}/>
                <div className="part-row" style={{display:"grid",gridTemplateColumns:"1fr auto 90px 90px auto",gap:7,alignItems:"end",flex:1}}>
                  <Inp label={idx===0?"Part name":""} value={row.name} onChange={e=>updateRow(row.id,"name",e.target.value)} placeholder="RX 580"/>
                  <CategoryPicker label={idx===0?"Cat":"."} value={row.category} onChange={v=>updateRow(row.id,"category",v)} customCategories={state.customCategories} dispatch={dispatch} style={{minWidth:90}}/>
                  <Inp label={idx===0?"Market (₱)":""} type="number" value={row.marketValue} onChange={e=>updateRow(row.id,"marketValue",e.target.value)} placeholder="4000"/>
                  <Inp label={idx===0?"Notes":""} value={row.notes||""} onChange={e=>updateRow(row.id,"notes",e.target.value)} placeholder="condition"/>
                  <button onClick={()=>removeRow(row.id)} style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:20,padding:"6px 4px",minHeight:36,transition:"color 0.1s"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#52525b"}>✕ Remove</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addRow} style={{marginTop:9,background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:12,fontWeight:600,padding:0}}
            onMouseEnter={e=>e.currentTarget.style.color="#a78bfa"} onMouseLeave={e=>e.currentTarget.style.color="#7c3aed"}>+ Add part</button>

          {dealScore!==null&&(
            <div style={{marginTop:14,background:"#09090b",borderRadius:10,padding:14,border:"1px solid #27272a"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:"#a1a1aa"}}>Market value</span><span style={{fontFamily:"monospace",color:"#fff"}}>{fmt(totalMarket)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:10}}>
                <span style={{color:"#a1a1aa"}}>You pay</span><span style={{fontFamily:"monospace",color:"#fff"}}>{fmt(paid)}</span>
              </div>
              <DealBar score={dealScore}/>
              <div style={{marginTop:10,borderTop:"1px solid #27272a",paddingTop:8}}>
                {partRows.filter(r=>r.name&&r.marketValue).map(r=>{
                  const mv=parseFloat(r.marketValue)||0;
                  const share=totalMarket>0?mv/totalMarket:0;
                  return <div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{color:"#71717a"}}>{r.name} ({pct(share)})</span>
                    <span style={{fontFamily:"monospace",color:"#d4d4d8"}}>{fmt(share*paid)}</span>
                  </div>;
                })}
              </div>
            </div>
          )}
          <div style={{marginTop:14}}><Btn loading={loading} onClick={submitBundle} disabled={!bundleName||!purchasePrice||totalMarket===0} style={{width:"100%"}}>Add Bundle to Inventory</Btn></div>
        </Card>
      )}

      {mode==="single"&&(
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:14}}>Single Part</div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Photo (optional)" photoUrl={singlePhoto.photoUrl} photoRecordId={singlePhoto.photoRecordId} onChange={setSinglePhoto}/>
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Part name" value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="GTX 1060 6GB"/>
            <CategoryPicker label="Category" value={singleCat} onChange={setSingleCat} customCategories={state.customCategories} dispatch={dispatch}/>
            <Inp label="Cost (₱)" type="number" value={singleCost} onChange={e=>setSingleCost(e.target.value)} placeholder="3000"/>
            <Inp label="Market value (₱, optional)" type="number" value={singleMarket} onChange={e=>setSingleMarket(e.target.value)} placeholder="3500"/>
          </div>
          {/* Notes field  (#3) */}
          <div style={{marginTop:12}}>
            <Inp label="Notes — condition, extras, observations" value={singleNotes} onChange={e=>setSingleNotes(e.target.value)} placeholder="Tested working. Includes original box."/>
          </div>
          <div style={{marginTop:14}}><Btn loading={loading} onClick={submitSingle} disabled={!singleName||!singleCost} style={{width:"100%"}}>Add to Inventory</Btn></div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   INVENTORY  (#1 quick sell, #2 edit, #3 notes, #8 search, #10 buyer)
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   PART DETAIL SHEET — tap a card to see full details + actions,
   instead of every action always being visible on the card itself
═══════════════════════════════════════════ */
function PartDetailSheet({part,buildName,onClose,openLightbox,onQuickSell,onEdit,onDefective,onDelete,onDuplicate,onAddToBuild,onGoToBuild}) {
  const potential=part.marketValue-part.allocatedCost;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#18181b",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:520,
        maxHeight:"88vh",overflowY:"auto",animation:"slideUp 0.22s cubic-bezier(0.22,1,0.36,1)",
        paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
        {/* Drag handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:38,height:4,borderRadius:99,background:"#3f3f46"}}/>
        </div>

        {/* Photo */}
        <div style={{width:"100%",aspectRatio:"16/10",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",
          cursor:part.photoUrl?"pointer":"default",borderBottom:"1px solid #27272a"}}
          onClick={part.photoUrl?()=>openLightbox(part.photoUrl):undefined}>
          {part.photoUrl?(
            <img src={part.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ):(
            <span style={{fontSize:48,opacity:0.25}}>🔧</span>
          )}
        </div>

        <div style={{padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:19}}>{part.name}</div>
            <Badge s={part.status}/>
          </div>

          {/* Purchase details */}
          <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14,marginBottom:14}}>
            <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Purchase Details</div>
            {[["Bought",fmt(part.allocatedCost),"#fff"],["Market value",fmt(part.marketValue),"#d4d4d8"],
              ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?"#34d399":"#f87171"]
            ].map(([l,v,c],i)=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?"1px solid #27272a":"none"}}>
                <span style={{color:"#a1a1aa"}}>{l}</span>
                <span style={{fontFamily:"monospace",fontWeight:i===2?700:600,color:c}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Category / source / date / status detail */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            <DetailRow label="Category" value={part.category}/>
            <DetailRow label="Purchase Source" value={part.source}/>
            {part.history?.[0]?.date&&<DetailRow label="Purchase Date" value={part.history[0].date}/>}
            {buildName&&<DetailRow label="Status" value={`Used in ${buildName}`} valueColor="#7dd3fc"/>}
            {part.soldTo&&<DetailRow label="Sold To" value={part.soldTo}/>}
            {part.notes&&<DetailRow label="Notes" value={part.notes}/>}
          </div>

          {/* Actions */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {part.status==="available"&&(
              <div style={{display:"flex",gap:8}}>
                <Btn variant="success" onClick={onQuickSell} style={{flex:1}}>⚡ Quick Sell</Btn>
                <Btn variant="ghost" onClick={onAddToBuild} style={{flex:1}}>🛠️ Add to Build</Btn>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" onClick={onEdit} style={{flex:1}}>✏️ Edit</Btn>
              <Btn variant="ghost" onClick={onDuplicate} style={{flex:1}}>⧉ Duplicate</Btn>
            </div>
            {part.status==="in_build"?(
              <div style={{marginTop:6,paddingTop:14,borderTop:"1px solid #27272a"}}>
                <div style={{fontSize:12,color:"#71717a",lineHeight:1.5,marginBottom:8}}>
                  This part is used in <strong style={{color:"#7dd3fc"}}>{buildName}</strong>. Dissolve that build first to free it up before editing its defective/delete status here.
                </div>
                <Btn variant="ghost" onClick={onGoToBuild} style={{width:"100%"}}>🛠️ Go to {buildName}</Btn>
              </div>
            ):(
              <div style={{display:"flex",gap:8,marginTop:6,paddingTop:14,borderTop:"1px solid #27272a"}}>
                {part.status!=="sold"&&part.status!=="defective"&&(
                  <Btn variant="warn" onClick={onDefective} style={{flex:1}}>⚠️ Mark Defective</Btn>
                )}
                <Btn variant="danger" onClick={onDelete} style={{flex:1}}>🗑 Delete</Btn>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({label,value,valueColor="#fff"}) {
  return (
    <div>
      <div style={{fontSize:11,color:"#71717a",marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,color:valueColor}}>{value}</div>
    </div>
  );
}

function Inventory({state,dispatch,toast,setTab,openLightbox}) {
  const [statusFilter,setStatusFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [search,setSearch]=useState("");   // #8
  const [viewing,setViewing]=useState(null); // part shown in the detail sheet
  const [bundleView,setBundleView]=useState(false);
  const [quickSell,setQuickSell]=useState(null);
  const [editing,setEditing]=useState(null);
  const [deleting,setDeleting]=useState(null); // part pending delete confirmation
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
    if(statusFilter!=="all"&&p.status!==statusFilter)return false;
    if(catFilter!=="all"&&p.category!==catFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.category.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const handleQuickSell=(sp,buyer)=>{
    if(!quickSell)return;
    const p=quickSell;
    const sale={id:uid(),partId:p.id,name:p.name,cost:p.allocatedCost,salePrice:sp,profit:sp-p.allocatedCost,buyerName:buyer,date:today()};
    dispatch({type:"SELL",mode:"part",id:p.id,sale});
    toast(`${p.name} sold for ${fmt(sp)} — profit ${fmt(sp-p.allocatedCost)} ✓`,sp-p.allocatedCost>=0?"success":"warn");
    setQuickSell(null);setViewing(null);
  };

  const handleEdit=(changes,desc)=>{
    dispatch({type:"UPDATE_PART",id:editing.id,changes,desc});
    toast(`${editing.name} updated ✓`);
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
    toast(`Duplicated ${p.name} ✓`);
    setViewing(null);
  };

  const goAddToBuild=()=>{
    setViewing(null);
    toast("Pick this part (and any others) on the Builds tab to assemble a PC");
    setTab("Builds");
  };

  const goToBuild=()=>{
    setViewing(null);
    toast("Find this build on the Builds tab to dissolve it");
    setTab("Builds");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {quickSell&&<QuickSellModal part={quickSell} onClose={()=>setQuickSell(null)} onConfirm={handleQuickSell} targetMargin={settings?.targetMargin||30}/>}
      {editing&&<EditPartModal part={editing} onClose={()=>setEditing(null)} onSave={handleEdit} dispatch={dispatch} customCategories={state.customCategories}/>}
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

      <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Inventory</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>{parts.length} parts tracked</p></div>

      {/* Search  (#8) */}
      <Inp label="" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search by name or category..."/>

      {/* Category filter chips */}
      {categoriesPresent.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Btn small variant={catFilter==="all"?"primary":"ghost"} onClick={()=>setCatFilter("all")}>All Categories</Btn>
          {categoriesPresent.map(c=>(
            <Btn key={c} small variant={catFilter===c?"primary":"ghost"} onClick={()=>setCatFilter(c)}>{c}</Btn>
          ))}
        </div>
      )}

      {/* Status filter chips */}
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {["all","available","in_build","sold","defective"].map(f=>(
          <Btn key={f} variant={!bundleView&&statusFilter===f?"primary":"ghost"} onClick={()=>{setStatusFilter(f);setBundleView(false);}}>
            {f==="all"?"All":f.replace("_"," ")}
            <span style={{background:"#3f3f46",borderRadius:99,padding:"1px 6px",fontSize:11,color:"#a1a1aa",marginLeft:2}}>
              {f==="all"?parts.length:parts.filter(p=>p.status===f).length}
            </span>
          </Btn>
        ))}
        <Btn variant={bundleView?"primary":"ghost"} onClick={()=>setBundleView(true)}>📦 Bundles</Btn>
      </div>

      {bundleView?(
        bundles.length===0?(
          <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No bundles yet.</div></Card>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {bundles.map((b,i)=>{
              const bParts=parts.filter(p=>p.bundleId===b.id);
              return (
                <Card key={b.id} style={{animation:`fadeUp 0.2s ease ${i*0.03}s both`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
                    <div style={{display:"flex",gap:11,minWidth:0}}>
                      {b.photoUrl&&<PhotoThumb url={b.photoUrl} size={56} seed={i} onClick={()=>openLightbox(b.photoUrl)}/>}
                      <div>
                        <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{b.name}</div>
                        <div style={{color:"#71717a",fontSize:11,marginTop:2}}>{b.date} · {bParts.length} parts · paid {fmt(b.purchasePrice)}</div>
                      </div>
                    </div>
                    <Btn small variant="danger" onClick={()=>setDeleting({...b,_isBundle:true})}>🗑</Btn>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid #27272a",paddingTop:10}}>
                    {bParts.map(p=>(
                      <div key={p.id} onClick={()=>setViewing(p)} style={{display:"flex",alignItems:"center",gap:9,fontSize:12,cursor:"pointer"}}>
                        <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length}/>
                        <span style={{color:"#d4d4d8",flex:1,minWidth:0}}>{p.name}</span>
                        <span style={{color:"#52525b",fontSize:10}}>{p.category}</span>
                        <Badge s={p.status}/>
                        <span style={{fontFamily:"monospace",color:"#a1a1aa",fontSize:11}}>{fmt(p.allocatedCost)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ):filtered.length===0?(
        <Card style={{textAlign:"center",padding:36}}>
          <div style={{color:"#52525b"}}>{search?"No parts match your search.":"No parts here yet."}</div>
        </Card>
      ):(
        /* Marketplace-style 2-column card grid — replaces the old always-expanded list so
           scanning 50-100+ parts is fast, with full detail only a tap away. */
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {filtered.map((p,i)=>{
            const potential=p.marketValue-p.allocatedCost;
            return (
              <div key={p.id} onClick={()=>setViewing(p)} style={{background:"#18181b",border:"1px solid #27272a",borderRadius:13,
                padding:10,cursor:"pointer",animation:`fadeUp 0.18s ease ${Math.min(i*0.025,0.3)}s both`,transition:"border-color 0.15s,transform 0.1s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#52525b";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#27272a";}}
                onMouseDown={e=>e.currentTarget.style.transform="scale(0.98)"}
                onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
                <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:"#09090b",marginBottom:8,
                  display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #1f1f23"}}>
                  {p.photoUrl?(
                    <img src={p.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  ):(
                    <span style={{fontSize:26,opacity:0.3}}>🔧</span>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:3}}>
                  <Badge s={p.status}/>
                  <span style={{color:"#52525b",fontSize:9,whiteSpace:"nowrap"}}>{p.category}</span>
                </div>
                <div style={{color:"#fff",fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:"#fff",fontSize:13}}>{fmt(p.allocatedCost)}</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#71717a",marginTop:2}}>
                  <span>Market {fmt(p.marketValue)}</span>
                  <span style={{color:potential>=0?"#34d399":"#f87171",fontWeight:600}}>{potential>=0?"+":""}{fmt(potential)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BUILDS
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   BUILD DETAIL SHEET — tap a build card to see full cost breakdown, components, and actions,
   matching the exact same pattern as PartDetailSheet / TransactionDetailSheet for consistency.
═══════════════════════════════════════════ */
function BuildDetailSheet({build,parts,onClose,openLightbox,onDissolve,onCopySpecs,onDelete}) {
  const cost=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const market=parts.reduce((s,p)=>s+p.marketValue,0);
  const potential=market-cost;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#18181b",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:520,
        maxHeight:"88vh",overflowY:"auto",animation:"slideUp 0.22s cubic-bezier(0.22,1,0.36,1)",
        paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:38,height:4,borderRadius:99,background:"#3f3f46"}}/>
        </div>

        <div style={{width:"100%",aspectRatio:"16/10",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",
          cursor:build.photoUrl?"pointer":"default",borderBottom:"1px solid #27272a"}}
          onClick={build.photoUrl?()=>openLightbox(build.photoUrl):undefined}>
          {build.photoUrl?(
            <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ):(
            <span style={{fontSize:48,opacity:0.25}}>🖥️</span>
          )}
        </div>

        <div style={{padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:19}}>{build.name}</div>
            <span style={{fontSize:11,fontWeight:700,color:"#7dd3fc",textTransform:"uppercase",letterSpacing:"0.05em"}}>Active Build</span>
          </div>

          {/* Cost breakdown */}
          <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14,marginBottom:14}}>
            <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Cost Breakdown</div>
            {[["Total cost",fmt(cost),"#fff"],["Market value",fmt(market),"#d4d4d8"],
              ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?"#34d399":"#f87171"]
            ].map(([l,v,c],i)=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?"1px solid #27272a":"none"}}>
                <span style={{color:"#a1a1aa"}}>{l}</span>
                <span style={{fontFamily:"monospace",fontWeight:i===2?700:600,color:c}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Components */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Components ({parts.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {parts.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:9}}>
                  <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length} onClick={p.photoUrl?()=>openLightbox(p.photoUrl):undefined}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"#fff",fontSize:13}}>{p.name}</div>
                    <div style={{color:"#71717a",fontSize:10}}>{p.category}</div>
                  </div>
                  <span style={{fontFamily:"monospace",fontSize:12,color:"#d4d4d8"}}>{fmt(p.allocatedCost)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction history */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            <DetailRow label="Created" value={build.date}/>
          </div>

          {/* Actions */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Btn variant="ghost" onClick={onDissolve} style={{width:"100%"}}>↩️ Dissolve Build — Return Parts to Inventory</Btn>
            <Btn variant="ghost" onClick={onCopySpecs} style={{width:"100%"}}>📋 Copy Specs for Listing</Btn>
            <div style={{paddingTop:6,borderTop:"1px solid #27272a",marginTop:6}}>
              <Btn variant="danger" onClick={onDelete} style={{width:"100%"}}>🗑 Delete Build</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Builds({state,dispatch,toast,openLightbox}) {
  const [creating,setCreating]=useState(false);
  const [buildName,setBuildName]=useState("");
  const [sel,setSel]=useState([]);
  const [activeCat,setActiveCat]=useState(null); // which category chip is currently expanded into a grid
  const [pickerSearch,setPickerSearch]=useState("");
  const [buildPhoto,setBuildPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [deletingBuild,setDeletingBuild]=useState(null);
  const [viewingBuild,setViewingBuild]=useState(null); // build shown in the detail sheet
  // Domain Firewall: Builds must never see General Assets (phones, vehicles, etc.), only PC Parts.
  // This is enforced at the data-access layer here, not just hidden in the UI, so there's no path
  // for a non-PC item to end up selected into a build's partIds.
  const avail=state.parts.filter(p=>p.status==="available"&&domainOf(p.category,state.customCategories)==="pc_part");
  const buildCost=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0);
  const buildMarket=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.marketValue,0);
  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  // Group available parts by category for the chip picker. Built-in categories come first (in
  // their fixed order), followed by any custom PC Part categories the user has added — custom
  // General Asset categories never reach this list at all, since `avail` already excludes them.
  const customPcPartCats=(state.customCategories||[]).filter(c=>c.domain==="pc_part").map(c=>c.name);
  const categoriesPresent=[...CATEGORIES,...customPcPartCats].filter(c=>avail.some(p=>p.category===c));
  const partsInActiveCat=activeCat?avail.filter(p=>p.category===activeCat&&
    (!pickerSearch||p.name.toLowerCase().includes(pickerSearch.toLowerCase()))):[];
  const selectedCountByCat=cat=>avail.filter(p=>p.category===cat&&sel.includes(p.id)).length;

  const submit=()=>{
    if(!buildName||sel.length===0){toast("Name the build and pick parts","error");return;}
    dispatch({type:"CREATE_BUILD",build:{id:uid(),name:buildName,partIds:sel,date:today(),photoUrl:buildPhoto.photoUrl,photoRecordId:buildPhoto.photoRecordId}});
    toast(`Build "${buildName}" created ✓`);
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

  // Marketplace-ready spec text, copied to clipboard for pasting into Facebook Marketplace etc.
  const copySpecs=(build,bp)=>{
    const lines=[`${build.name}`,"",...bp.map(p=>`• ${p.category}: ${p.name}${p.notes?` (${p.notes})`:""}`),"",`Asking price: ${fmt(bp.reduce((s,p)=>s+p.marketValue,0))}`];
    const text=lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      ()=>toast("Specs copied — paste into your listing ✓"),
      ()=>toast("Couldn't copy — clipboard not available","error")
    );
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
      {viewingBuild&&(()=>{
        const bp=state.parts.filter(p=>viewingBuild.partIds.includes(p.id));
        return (
          <BuildDetailSheet build={viewingBuild} parts={bp} onClose={()=>setViewingBuild(null)} openLightbox={openLightbox}
            onDissolve={()=>{dissolve(viewingBuild);setViewingBuild(null);}}
            onCopySpecs={()=>copySpecs(viewingBuild,bp)}
            onDelete={()=>{setDeletingBuild(viewingBuild);setViewingBuild(null);}}/>
        );
      })()}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Builds</h2>
          <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Group parts into a sellable PC.</p></div>
        {!creating&&<Btn onClick={()=>setCreating(true)}>+ New Build</Btn>}
      </div>

      {creating&&(
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:12}}>New Build</div>
          <div style={{marginBottom:14}}>
            <PhotoUpload label="Build photo (optional) — the finished PC" photoUrl={buildPhoto.photoUrl} photoRecordId={buildPhoto.photoRecordId} onChange={setBuildPhoto}/>
          </div>
          <Inp label="Build name" value={buildName} onChange={e=>setBuildName(e.target.value)} placeholder="Gaming Rig #1"/>

          {/* Category chips — tap a category to expand its parts into a card grid below.
              A green checkmark + count shows once a category has at least one selected part. */}
          <div style={{fontSize:12,color:"#a1a1aa",margin:"14px 0 8px"}}>Pick parts by category:</div>
          {avail.length===0?<div style={{color:"#52525b",fontSize:13}}>No available parts.</div>:(
            <>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {categoriesPresent.map(cat=>{
                  const count=selectedCountByCat(cat);
                  const isActive=activeCat===cat;
                  return (
                    <button key={cat} onClick={()=>{setActiveCat(isActive?null:cat);setPickerSearch("");}}
                      style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:99,fontSize:12.5,fontWeight:600,cursor:"pointer",
                        border:`1px solid ${isActive?"#7c3aed":count>0?"#16a34a":"#3f3f46"}`,
                        background:isActive?"rgba(124,58,237,0.15)":count>0?"rgba(6,78,59,0.35)":"#09090b",
                        color:isActive?"#a78bfa":count>0?"#6ee7b7":"#d4d4d8",transition:"all 0.15s"}}>
                      {count>0&&<span>✓</span>}
                      <span>{cat}</span>
                      <span style={{opacity:0.7}}>({avail.filter(p=>p.category===cat).length}{count>0?`, ${count} picked`:""})</span>
                    </button>
                  );
                })}
              </div>

              {activeCat&&(
                <div style={{marginBottom:14,animation:"fadeUp 0.18s ease"}}>
                  <Inp label="" value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder={`🔍  Search ${activeCat}...`}/>
                  {partsInActiveCat.length===0?(
                    <div style={{color:"#52525b",fontSize:13,padding:"14px 0"}}>No {activeCat} parts match.</div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:10}}>
                      {partsInActiveCat.map(p=>{
                        const checked=sel.includes(p.id);
                        return (
                          <div key={p.id} onClick={()=>toggle(p.id)} style={{cursor:"pointer",borderRadius:11,padding:9,
                            border:`1.5px solid ${checked?"#7c3aed":"#27272a"}`,background:checked?"rgba(124,58,237,0.1)":"#09090b",
                            transition:"all 0.12s",position:"relative"}}>
                            {checked&&<div style={{position:"absolute",top:6,right:6,width:18,height:18,borderRadius:"50%",
                              background:"#7c3aed",color:"#fff",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</div>}
                            <div style={{width:"100%",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:"#18181b",marginBottom:6,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {p.photoUrl?<img src={p.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:20,opacity:0.3}}>🔧</span>}
                            </div>
                            <div style={{color:"#fff",fontSize:12,fontWeight:600,lineHeight:1.3,marginBottom:3,
                              display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
                            <div style={{fontFamily:"monospace",fontSize:11.5,color:"#d4d4d8"}}>{fmt(p.allocatedCost)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Sticky-feeling build summary — selected parts grouped, with live cost roll-up */}
          {sel.length>0&&(
            <div style={{marginTop:4,paddingTop:12,borderTop:"1px solid #27272a"}}>
              <div style={{fontSize:12,color:"#a1a1aa",marginBottom:8}}>Selected ({sel.length}):</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10,maxHeight:160,overflowY:"auto"}}>
                {avail.filter(p=>sel.includes(p.id)).map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <PhotoThumb url={p.photoUrl} size={26} seed={p.id.length}/>
                    <span style={{color:"#d4d4d8",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span style={{fontFamily:"monospace",color:"#71717a"}}>{fmt(p.allocatedCost)}</span>
                    <button onClick={()=>toggle(p.id)} style={{background:"none",border:"none",color:"#52525b",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                <span style={{color:"#a1a1aa"}}>Build cost so far</span><span style={{fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{fmt(buildCost)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#a1a1aa"}}>Market value</span><span style={{fontFamily:"monospace",color:"#d4d4d8"}}>{fmt(buildMarket)}</span>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <Btn onClick={submit} disabled={!buildName||sel.length===0}>Save Build</Btn>
            <Btn variant="ghost" onClick={()=>{setCreating(false);setSel([]);setBuildName("");setActiveCat(null);}}>Cancel</Btn>
          </div>
        </Card>
      )}

      {state.builds.filter(b=>!b.dissolved&&!b.sold).length===0&&!creating?(
        <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No active builds.</div></Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {state.builds.filter(b=>!b.dissolved&&!b.sold).map(build=>{
            const bp=state.parts.filter(p=>build.partIds.includes(p.id));
            const cost=bp.reduce((s,p)=>s+p.allocatedCost,0);
            const market=bp.reduce((s,p)=>s+p.marketValue,0);
            return (
              <Card key={build.id} style={{padding:0,overflow:"hidden",cursor:"pointer"}} onClick={()=>setViewingBuild(build)}>
                {/* Hero image — same large-photo treatment as the part/transaction detail sheets,
                    so a finished build reads as a real listing rather than a data row. Tapping
                    anywhere on the card (including the photo) opens the detail sheet, matching
                    the same tap-to-open pattern used for Inventory parts and History transactions —
                    actions live inside that sheet instead of always-visible buttons on the card. */}
                <div style={{width:"100%",aspectRatio:"16/9",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid #27272a"}}>
                  {build.photoUrl?(
                    <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  ):(
                    <span style={{fontSize:40,opacity:0.25}}>🖥️</span>
                  )}
                </div>

                <div style={{padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11,gap:10}}>
                    <div><div style={{color:"#fff",fontWeight:700,fontSize:15}}>{build.name}</div>
                      <div style={{color:"#71717a",fontSize:11,marginTop:2}}>{build.date} · {bp.length} parts</div></div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{fmt(cost)}</div>
                      <div style={{fontSize:10,color:"#71717a"}}>market {fmt(market)}</div>
                    </div>
                  </div>

                  {/* Component badge tags — core parts at a glance */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {bp.map(p=>(
                      <span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#27272a",border:"1px solid #3f3f46",
                        borderRadius:99,fontSize:11,padding:"4px 10px",color:"#d4d4d8"}}>
                        <span style={{color:"#a78bfa",fontWeight:600}}>{p.category}</span>
                        <span>{p.name}</span>
                        <span style={{color:"#71717a"}}>{fmt(p.allocatedCost)}</span>
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

/* ═══════════════════════════════════════════
   SELL  (#5 price suggestion, #10 buyer name)
═══════════════════════════════════════════ */
function Sell({state,dispatch,toast,openLightbox}) {
  const [mode,setMode]=useState("part");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");   // #10
  const [convoLink,setConvoLink]=useState(""); // link to the chat/conversation where the sale was agreed
  const [proofPhoto,setProofPhoto]=useState({photoUrl:"",photoRecordId:""}); // screenshot/photo proof of the transaction
  const [loading,setLoading]=useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  const targetMargin=state.settings?.targetMargin||30;

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const tp=avail.find(p=>p.id===selId);
  const tb=builds.find(b=>b.id===selId);
  const cost=mode==="part"?tp?.allocatedCost||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
  const marketVal=mode==="part"?tp?.marketValue||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.marketValue,0):0;
  const suggestedCostPlus=cost>0?Math.round(cost*(1+targetMargin/100)):0;  // #5
  const sp=parseFloat(salePrice)||0;
  const profit=sp-cost;
  const margin=cost>0?profit/cost:0;
  const selectedPhoto=mode==="part"?tp?.photoUrl:tb?.photoUrl;
  const selectedLabel=mode==="part"?tp?.name:tb?.name;

  const submit=()=>{
    if(!selId||!salePrice){toast("Select item and enter price","error");return;}
    setLoading(true);
    const name=mode==="part"?tp?.name:tb?.name;
    setTimeout(()=>{
      dispatch({type:"SELL",mode,id:selId,sale:{id:uid(),partId:mode==="part"?selId:null,buildId:mode==="build"?selId:null,name,cost,salePrice:sp,profit,buyerName:buyer,date:today(),
        convoLink:convoLink.trim(),proofPhotoUrl:proofPhoto.photoUrl,proofPhotoRecordId:proofPhoto.photoRecordId}});
      toast(`${name} sold for ${fmt(sp)} — profit ${fmt(profit)} ✓`,profit>=0?"success":"warn");
      setSelId("");setSalePrice("");setBuyer("");setConvoLink("");setProofPhoto({photoUrl:"",photoRecordId:""});setLoading(false);
    },400);
  };

  const list=mode==="part"?avail:builds;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Sell</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Record a sale and lock in your profit.</p></div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant={mode==="part"?"primary":"ghost"} onClick={()=>{setMode("part");setSelId("");setPickerOpen(false);}}>Sell Part</Btn>
        <Btn variant={mode==="build"?"primary":"ghost"} onClick={()=>{setMode("build");setSelId("");setPickerOpen(false);}}>Sell Build</Btn>
      </div>
      <Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Photo-enabled picker — a native <select> can't render images, so this is a custom dropdown.
              The options panel is absolutely positioned so it floats over the form instead of
              pushing the Sale price / Record Sale button down the page as the list grows. */}
          <div style={{position:"relative"}}>
            <div style={{fontSize:12,color:"#a1a1aa",marginBottom:5}}>{mode==="part"?"Select part":"Select build"}</div>
            <button type="button" onClick={()=>setPickerOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,
              background:"#09090b",border:"1px solid #3f3f46",borderRadius:9,padding:"9px 12px",cursor:"pointer",textAlign:"left"}}>
              {selId?(
                <>
                  <PhotoThumb url={selectedPhoto} size={34} seed={selId.length}/>
                  <span style={{color:"#fff",fontSize:13,flex:1}}>{selectedLabel}</span>
                  <span style={{fontFamily:"monospace",fontSize:12,color:"#a1a1aa"}}>{mode==="part"?fmt(tp?.allocatedCost||0):""}</span>
                </>
              ):<span style={{color:"#52525b",fontSize:13,flex:1}}>— choose —</span>}
              <span style={{color:"#71717a",fontSize:11}}>{pickerOpen?"▲":"▼"}</span>
            </button>
            {pickerOpen&&(
              <>
                {/* Invisible backdrop — click outside the panel to close without selecting anything */}
                <div onClick={()=>setPickerOpen(false)} style={{position:"fixed",inset:0,zIndex:40}}/>
                <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:6,background:"#18181b",
                  border:"1px solid #3f3f46",borderRadius:9,overflow:"hidden",maxHeight:280,overflowY:"auto",
                  animation:"fadeUp 0.15s ease",boxShadow:"0 12px 28px rgba(0,0,0,0.55)",zIndex:50}}>
                  {list.length===0?(
                    <div style={{padding:14,color:"#52525b",fontSize:13}}>Nothing available to sell.</div>
                  ):list.map(item=>(
                    <button key={item.id} type="button" onClick={()=>{setSelId(item.id);setPickerOpen(false);}}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:selId===item.id?"rgba(124,58,237,0.12)":"#18181b",
                        border:"none",borderBottom:"1px solid #27272a",padding:"9px 12px",cursor:"pointer",textAlign:"left"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,0.08)"}
                      onMouseLeave={e=>e.currentTarget.style.background=selId===item.id?"rgba(124,58,237,0.12)":"#18181b"}>
                      <PhotoThumb url={item.photoUrl} size={34} seed={item.id.length}/>
                      <span style={{color:"#fff",fontSize:13,flex:1}}>{item.name}</span>
                      <span style={{fontFamily:"monospace",fontSize:12,color:"#a1a1aa"}}>{mode==="part"?fmt(item.allocatedCost):""}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Price suggestion  (#5) — two options, since anchoring only to cost-plus-margin
              undersells when the item's real market value is much higher than what it cost to acquire. */}
          {selId&&(cost>0||marketVal>0)&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {cost>0&&(
                <div style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:9,padding:"9px 12px",fontSize:12,color:"#a78bfa",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>Cost + {targetMargin}% margin</span>
                  <button onClick={()=>setSalePrice(String(suggestedCostPlus))} style={{background:"#7c3aed",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Use {fmt(suggestedCostPlus)}
                  </button>
                </div>
              )}
              {marketVal>0&&(
                <div style={{background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.25)",borderRadius:9,padding:"9px 12px",fontSize:12,color:"#7dd3fc",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>Use market price</span>
                  <button onClick={()=>setSalePrice(String(marketVal))} style={{background:"#0ea5e9",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Use {fmt(marketVal)}
                  </button>
                </div>
              )}
            </div>
          )}
          <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000"/>
          {/* Buyer name  (#10) */}
          <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
          {/* Conversation link + transaction proof photo — useful for disputes or just keeping a record */}
          <Inp label="Conversation link (optional)" value={convoLink} onChange={e=>setConvoLink(e.target.value)} placeholder="https://m.me/... or FB Marketplace chat link"/>
          <PhotoUpload label="Proof of transaction (optional) — screenshot or photo" photoUrl={proofPhoto.photoUrl} photoRecordId={proofPhoto.photoRecordId} onChange={setProofPhoto}/>
          {selId&&sp>0&&(
            <div style={{background:"#09090b",borderRadius:9,padding:13,border:"1px solid #27272a",animation:"fadeUp 0.2s ease"}}>
              {[["Cost",fmt(cost),"#fff"],["Sale price",fmt(sp),"#fff"],
                ["Profit",`${profit>=0?"+":""}${fmt(profit)} (${pct(margin)})`,profit>=0?"#34d399":"#f87171"]
              ].map(([l,v,c],i)=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?6:0,paddingTop:i===2?8:0,borderTop:i===2?"1px solid #27272a":"none"}}>
                  <span style={{color:"#a1a1aa"}}>{l}</span>
                  <span style={{fontFamily:"monospace",fontWeight:i===2?700:400,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <Btn variant="success" loading={loading} onClick={submit} disabled={!selId||!salePrice} style={{width:"100%"}}>Record Sale</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HISTORY  (+ #4 CSV export)
═══════════════════════════════════════════ */
function History({state,dispatch,toast,openLightbox}) {
  const [view,setView]=useState("transactions"); // "transactions" | "partTimeline"
  const [sel,setSel]=useState("");
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all"); // all | part | build | returned | deleted
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [plFilter,setPlFilter]=useState("all"); // all | profit | loss
  const [viewingSale,setViewingSale]=useState(null);
  const [editingSale,setEditingSale]=useState(null);
  const [undoingSale,setUndoingSale]=useState(null);
  const [deletingSale,setDeletingSale]=useState(null);
  const part=state.parts.find(p=>p.id===sel);

  const allSales=state.sales;
  const activeSales=allSales.filter(s=>!s.deleted&&!s.returned&&!s.writeOff);

  const filtered=allSales.filter(s=>{
    if(s.writeOff)return false; // write-offs are losses, not sales transactions — shown on Dashboard instead
    if(typeFilter==="returned"&&!s.returned)return false;
    if(typeFilter==="deleted"&&!s.deleted)return false;
    if(typeFilter==="part"&&(s.deleted||s.returned||s.buildId))return false;
    if(typeFilter==="build"&&(s.deleted||s.returned||!s.buildId))return false;
    if(typeFilter==="all"&&(s.deleted||s.returned))return false; // "all" means all *active* transactions
    if(search){
      const q=search.toLowerCase();
      if(!s.name.toLowerCase().includes(q)&&!(s.buyerName||"").toLowerCase().includes(q))return false;
    }
    if(dateFrom&&new Date(s.date)<new Date(dateFrom))return false;
    if(dateTo&&new Date(s.date)>new Date(dateTo))return false;
    if(plFilter==="profit"&&s.profit<0)return false;
    if(plFilter==="loss"&&s.profit>=0)return false;
    return true;
  });

  // Sales Analytics  — computed over active (non-deleted, non-returned) sales only
  const totalRevenue=activeSales.reduce((s,x)=>s+x.salePrice,0);
  const totalProfitAll=activeSales.reduce((s,x)=>s+x.profit,0);
  const totalLosses=activeSales.filter(s=>s.profit<0).reduce((s,x)=>s+Math.abs(x.profit),0);
  const partsSoldCount=activeSales.filter(s=>!s.buildId).length;
  const buildsSoldCount=activeSales.filter(s=>s.buildId).length;
  const avgProfit=activeSales.length?totalProfitAll/activeSales.length:0;
  const catTotals={};
  activeSales.forEach(s=>{
    const p=state.parts.find(p=>p.id===s.partId);
    const cat=p?.category||(s.buildId?"Build":"Other");
    catTotals[cat]=(catTotals[cat]||0)+s.profit;
  });
  const bestCategory=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const bestItem=[...activeSales].sort((a,b)=>b.profit-a.profit)[0];

  const undoSale=(reason)=>{
    dispatch({type:"UNDO_SALE",saleId:undoingSale.id,reason});
    toast(`"${undoingSale.name}" sale undone — returned to inventory`,"warn");
    setUndoingSale(null);setViewingSale(null);
  };

  const saveEdit=(changes)=>{
    dispatch({type:"EDIT_SALE",saleId:editingSale.id,changes});
    toast("Transaction updated ✓");
    setEditingSale(null);
  };

  const deleteRecordOnly=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"record-only"});
    toast("Transaction record deleted","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const deleteAndReturn=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"undo-and-return"});
    toast("Transaction deleted — item returned to inventory","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  // #4 Export CSV
  const exportCSV=()=>{
    const rows=[["Name","Category","Source","Cost","Market Value","Status","Sale Price","Profit","Buyer","Date"]];
    state.parts.forEach(p=>{
      const sale=state.sales.find(s=>s.partId===p.id&&!s.deleted&&!s.returned)||state.sales.find(s=>s.name===p.name&&!s.deleted&&!s.returned);
      rows.push([p.name,p.category,p.source,p.allocatedCost,p.marketValue,p.status,sale?sale.salePrice:"",sale?sale.profit:"",sale?sale.buyerName||"":"",sale?.date||""]);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`pc-trader-${today().replace(/\s/g,"-")}.csv`;a.click();
    URL.revokeObjectURL(url);
  };

  const statusOf=s=>s.deleted?"deleted":s.returned?"returned":"completed";
  const statusColor={completed:"#6ee7b7",returned:"#fbbf24",deleted:"#71717a"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {viewingSale&&(
        <TransactionDetailSheet sale={viewingSale} state={state} openLightbox={openLightbox} onClose={()=>setViewingSale(null)}
          onEdit={()=>{setEditingSale(viewingSale);setViewingSale(null);}}
          onUndo={()=>{setUndoingSale(viewingSale);setViewingSale(null);}}
          onDelete={()=>{setDeletingSale(viewingSale);setViewingSale(null);}}/>
      )}
      {editingSale&&<EditSaleModal sale={editingSale} onClose={()=>setEditingSale(null)} onSave={saveEdit}/>}
      {undoingSale&&<ReturnReasonModal title="Undo this sale?" sale={undoingSale} onConfirm={undoSale} onCancel={()=>setUndoingSale(null)}/>}
      {deletingSale&&(
        <ConfirmModal title="Delete this transaction?" message={`What should happen to "${deletingSale.name}"?`}
          onCancel={()=>setDeletingSale(null)}
          extraChoices={[
            {label:"Delete record only (item stays sold)",onClick:deleteRecordOnly,variant:"warn"},
            {label:"Delete & return item to inventory",onClick:deleteAndReturn,variant:"success"},
          ]}/>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>History</h2>
          <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Transactions, sales analytics, and part movement.</p></div>
        <Btn variant="ghost" onClick={exportCSV} disabled={state.parts.length===0}>⬇ CSV</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14}}>
          <div style={{fontSize:10,color:"#a1a1aa",marginBottom:4}}>Business Wallet</div>
          <div style={{fontSize:18,fontWeight:700,color:"#34d399",fontFamily:"monospace"}}>{fmt(state.businessCash||0)}</div>
          <div style={{fontSize:11,color:"#52525b",marginTop:4}}>for parts & builds</div>
        </div>
        <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14}}>
          <div style={{fontSize:10,color:"#a1a1aa",marginBottom:4}}>Personal Wallet</div>
          <div style={{fontSize:18,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>{fmt(state.personalCash||0)}</div>
          <div style={{fontSize:11,color:"#52525b",marginTop:4}}>your separate personal funds</div>
        </div>
      </div>

      <div style={{display:"flex",gap:7}}>
        <Btn small variant={view==="transactions"?"primary":"ghost"} onClick={()=>setView("transactions")}>Transactions</Btn>
        <Btn small variant={view==="partTimeline"?"primary":"ghost"} onClick={()=>setView("partTimeline")}>Part Timeline</Btn>
      </div>

      {view==="partTimeline"?(
        <>
          <Sel label="Select part" value={sel} onChange={e=>setSel(e.target.value)}>
            <option value="">— choose a part —</option>
            {state.parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
          </Sel>
          {part&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
                <div style={{display:"flex",gap:11,minWidth:0}}>
                  {part.photoUrl&&<PhotoThumb url={part.photoUrl} size={56} seed={part.id.length} onClick={()=>openLightbox(part.photoUrl)}/>}
                  <div>
                    <div style={{color:"#fff",fontWeight:600,fontSize:15}}>{part.name}</div>
                    <div style={{color:"#71717a",fontSize:11,marginTop:2}}>{part.category} · {part.source}</div>
                    {part.notes&&<div style={{color:"#a1a1aa",fontSize:11,marginTop:3,fontStyle:"italic"}}>📝 {part.notes}</div>}
                    {part.soldTo&&<div style={{color:"#71717a",fontSize:11,marginTop:2}}>Sold to: {part.soldTo}</div>}
                  </div>
                </div>
                <Badge s={part.status}/>
              </div>
              <div style={{position:"relative",paddingLeft:16}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:1,background:"#3f3f46"}}/>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {part.history.map((h,i)=>(
                    <div key={i} style={{position:"relative",animation:`fadeUp 0.2s ease ${i*0.04}s both`}}>
                      <div style={{position:"absolute",left:-20,top:4,width:7,height:7,borderRadius:"50%",background:"#7c3aed"}}/>
                      <div style={{fontSize:10,color:"#71717a"}}>{h.date}</div>
                      <div style={{fontSize:13,color:"#d4d4d8",marginTop:2}}>{h.event}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {state.parts.length===0&&(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No parts yet.</div></Card>
          )}
        </>
      ):(
        <>
          {/* Sales Analytics */}
          {activeSales.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              <StatBox label="Total Revenue" value={fmt(totalRevenue)} color="#34d399"/>
              <StatBox label="Total Profit" value={fmt(totalProfitAll)} color={totalProfitAll>=0?"#34d399":"#f87171"}/>
              <StatBox label="Total Losses" value={fmt(-totalLosses)} color="#f87171"/>
              <StatBox label="Avg. Profit / Sale" value={fmt(avgProfit)}/>
              <StatBox label="Parts Sold" value={String(partsSoldCount)}/>
              <StatBox label="Builds Sold" value={String(buildsSoldCount)}/>
              {bestCategory&&<StatBox label="Best Category" value={bestCategory[0]} sub={`+${fmt(bestCategory[1])} profit`} color="#38bdf8"/>}
              {bestItem&&<StatBox label="Most Profitable Sale" value={bestItem.name} sub={`+${fmt(bestItem.profit)}`} color="#38bdf8"/>}
            </div>
          )}

          {/* Search + filters */}
          <Inp label="" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search by item or buyer name..."/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All"],["part","Parts only"],["build","Builds only"],["returned","Returned"],["deleted","Deleted"]].map(([v,l])=>(
              <Btn key={v} small variant={typeFilter===v?"primary":"ghost"} onClick={()=>setTypeFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All P/L"],["profit","Profit only"],["loss","Loss only"]].map(([v,l])=>(
              <Btn key={v} small variant={plFilter===v?"primary":"ghost"} onClick={()=>setPlFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="From date" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
            <Inp label="To date" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>

          {/* Transaction card grid — marketplace style */}
          {filtered.length===0?(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No transactions match.</div></Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {[...filtered].reverse().map((s,i)=>{
                const linkedPart=state.parts.find(p=>p.id===s.partId);
                const linkedBuild=state.builds.find(b=>b.id===s.buildId);
                const img=s.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
                const status=statusOf(s);
                return (
                  <div key={s.id} onClick={()=>setViewingSale(s)} style={{background:"#18181b",border:"1px solid #27272a",borderRadius:13,
                    padding:10,cursor:"pointer",animation:`fadeUp 0.18s ease ${Math.min(i*0.025,0.3)}s both`,transition:"border-color 0.15s",opacity:status==="deleted"?0.55:1}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#52525b"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#27272a"}>
                    <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:"#09090b",marginBottom:8,
                      display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #1f1f23"}}>
                      {img?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:26,opacity:0.3}}>{s.buildId?"🖥️":"🔧"}</span>}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:3}}>
                      <span style={{fontSize:9,fontWeight:700,color:statusColor[status],textTransform:"uppercase",letterSpacing:"0.05em"}}>{status}</span>
                      <span style={{color:"#52525b",fontSize:9}}>{s.buildId?"BUILD":"PART"}</span>
                    </div>
                    <div style={{color:"#fff",fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                      display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.name}</div>
                    <div style={{fontFamily:"monospace",fontWeight:700,color:"#fff",fontSize:13}}>{fmt(s.salePrice)}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#71717a",marginTop:2}}>
                      <span>{s.date}</span>
                      <span style={{color:s.profit>=0?"#34d399":"#f87171",fontWeight:600}}>{s.profit>=0?"+":""}{fmt(s.profit)}</span>
                    </div>
                    {s.buyerName&&<div style={{color:"#52525b",fontSize:10,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>👤 {s.buyerName}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TRANSACTION DETAIL SHEET — tap a History card for full transaction info + actions
═══════════════════════════════════════════ */
function TransactionDetailSheet({sale,state,openLightbox,onClose,onEdit,onUndo,onDelete}) {
  const status=sale.deleted?"deleted":sale.returned?"returned":"completed";
  const statusColor={completed:"#6ee7b7",returned:"#fbbf24",deleted:"#71717a"}[status];
  const linkedPart=state.parts.find(p=>p.id===sale.partId);
  const linkedBuild=state.builds.find(b=>b.id===sale.buildId);
  const img=sale.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#18181b",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:520,
        maxHeight:"88vh",overflowY:"auto",animation:"slideUp 0.22s cubic-bezier(0.22,1,0.36,1)",
        paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}><div style={{width:38,height:4,borderRadius:99,background:"#3f3f46"}}/></div>
        <div style={{width:"100%",aspectRatio:"16/10",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center",
          cursor:img?"pointer":"default",borderBottom:"1px solid #27272a"}}
          onClick={img?()=>openLightbox(img):undefined}>
          {img?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:48,opacity:0.25}}>{sale.buildId?"🖥️":"🔧"}</span>}
        </div>
        <div style={{padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:19}}>{sale.name}</div>
            <span style={{fontSize:11,fontWeight:700,color:statusColor,textTransform:"uppercase",letterSpacing:"0.05em"}}>{status}</span>
          </div>

          <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14,marginBottom:14}}>
            <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Transaction</div>
            {[["Cost price",fmt(sale.cost),"#fff"],["Sale price",fmt(sale.salePrice),"#fff"],
              ["Profit / Loss",`${sale.profit>=0?"+":""}${fmt(sale.profit)}`,sale.profit>=0?"#34d399":"#f87171"]
            ].map(([l,v,c],i)=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?"1px solid #27272a":"none"}}>
                <span style={{color:"#a1a1aa"}}>{l}</span>
                <span style={{fontFamily:"monospace",fontWeight:i===2?700:600,color:c}}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            <DetailRow label="Buyer" value={sale.buyerName||"—"}/>
            <DetailRow label="Sale Date" value={sale.date}/>
            {sale.convoLink&&(
              <div>
                <div style={{fontSize:11,color:"#71717a",marginBottom:2}}>Conversation</div>
                <a href={sale.convoLink} target="_blank" rel="noopener noreferrer" style={{color:"#7dd3fc",fontSize:13}}>🔗 Open conversation link</a>
              </div>
            )}
            {sale.notes&&<DetailRow label="Notes" value={sale.notes}/>}
            {sale.edited&&<DetailRow label="Last Edited" value={sale.editedAt} valueColor="#71717a"/>}
            {sale.returned&&<DetailRow label="Return Reason" value={sale.returnReason||"—"} valueColor="#fbbf24"/>}
          </div>

          {!sale.deleted&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn variant="ghost" onClick={onEdit}>✏️ Edit Transaction</Btn>
              {!sale.returned&&<Btn variant="warn" onClick={onUndo}>↩️ Undo Sale</Btn>}
              <div style={{paddingTop:6,borderTop:"1px solid #27272a",marginTop:6}}>
                <Btn variant="danger" onClick={onDelete} style={{width:"100%"}}>🗑 Delete Transaction</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EDIT SALE MODAL — modify transaction details without deleting the record
═══════════════════════════════════════════ */
function EditSaleModal({sale,onClose,onSave}) {
  const [salePrice,setSalePrice]=useState(String(sale.salePrice));
  const [buyerName,setBuyerName]=useState(sale.buyerName||"");
  const [notes,setNotes]=useState(sale.notes||"");
  const [date,setDate]=useState(sale.date);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:24,width:"100%",maxWidth:420,animation:"fadeUp 0.2s ease",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>Edit Transaction</div>
        <div style={{fontSize:12,color:"#71717a",marginBottom:16}}>{sale.name}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)}/>
          <Inp label="Buyer name" value={buyerName} onChange={e=>setBuyerName(e.target.value)}/>
          <Inp label="Sale date" value={date} onChange={e=>setDate(e.target.value)} placeholder="Jun 20, 2026"/>
          <Inp label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note about this sale"/>
          <div style={{fontSize:11,color:"#52525b"}}>Edits are logged with a timestamp for transparency.</div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn onClick={()=>onSave({salePrice:parseFloat(salePrice)||sale.salePrice,buyerName,notes,date})} style={{flex:1}}>Save Changes</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RETURN REASON MODAL — used for Undo Sale
═══════════════════════════════════════════ */
function ReturnReasonModal({title,sale,onConfirm,onCancel}) {
  const [reason,setReason]=useState("Buyer cancelled");
  const [other,setOther]=useState("");
  const reasons=["Buyer cancelled","Product returned","Incorrect sale entry","Other"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:6}}>{title}</div>
        <div style={{fontSize:13,color:"#a1a1aa",marginBottom:16}}>"{sale.name}" will be returned to inventory and the profit/loss reversed.</div>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
          {reasons.map(r=>(
            <label key={r} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"7px 10px",borderRadius:8,
              border:`1px solid ${reason===r?"#7c3aed":"#27272a"}`,background:reason===r?"rgba(124,58,237,0.1)":"transparent"}}>
              <input type="radio" checked={reason===r} onChange={()=>setReason(r)} style={{accentColor:"#7c3aed"}}/>
              <span style={{color:"#fff",fontSize:13}}>{r}</span>
            </label>
          ))}
        </div>
        {reason==="Other"&&<Inp label="Specify reason" value={other} onChange={e=>setOther(e.target.value)} placeholder="What happened?"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
          <Btn variant="warn" onClick={()=>onConfirm(reason==="Other"?(other||"Other"):reason)} style={{width:"100%"}}>Confirm Undo</Btn>
          <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS  (#5 target margin, #9 theme)
═══════════════════════════════════════════ */
function Settings({state,dispatch,toast,theme,setTheme}) {
  const [margin,setMargin]=useState(String(state.settings?.targetMargin||30));

  const save=()=>{
    dispatch({type:"SET_SETTING",key:"targetMargin",value:parseFloat(margin)||30});
    toast("Settings saved ✓");
  };

  const clearData=()=>{
    if(window.confirm("Delete ALL data? This cannot be undone.")){
      fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(initialState)})
        .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);window.location.reload();})
        .catch(()=>toast("Failed to clear data — check server connection","error"));
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Settings</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>App preferences.</p></div>
      <Card>
        <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:14}}>Wallet Balances</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14}}>
            <div style={{fontSize:10,color:"#a1a1aa",marginBottom:4}}>Business Wallet</div>
            <div style={{fontSize:18,fontWeight:700,color:"#34d399",fontFamily:"monospace"}}>{fmt(state.businessCash||0)}</div>
            <div style={{fontSize:11,color:"#52525b",marginTop:4}}>Used for buying & selling parts</div>
          </div>
          <div style={{background:"#09090b",border:"1px solid #27272a",borderRadius:11,padding:14}}>
            <div style={{fontSize:10,color:"#a1a1aa",marginBottom:4}}>Personal Wallet</div>
            <div style={{fontSize:18,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>{fmt(state.personalCash||0)}</div>
            <div style={{fontSize:11,color:"#52525b",marginTop:4}}>Your separate personal funds</div>
          </div>
        </div>
      </Card>
      <Card>
        <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:14}}>Selling Defaults</div>
        <div style={{maxWidth:260}}>
          <Inp label="Target profit margin (%)" type="number" value={margin} onChange={e=>setMargin(e.target.value)}/>
        </div>
        <div style={{fontSize:11,color:"#71717a",marginTop:6,marginBottom:14}}>Used to auto-suggest sale prices in the Sell tab and Quick Sell modal.</div>
        <Btn onClick={save}>Save</Btn>
      </Card>

      {/* #9 Theme toggle */}
      <Card>
        <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:14}}>Appearance</div>
        <div style={{display:"flex",gap:8}}>
          {["dark","light"].map(t=>(
            <Btn key={t} variant={theme===t?"primary":"ghost"} onClick={()=>setTheme(t)}>
              {t==="dark"?"🌙 Dark":"☀️ Light"}
            </Btn>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{fontWeight:600,fontSize:13,color:"#d4d4d8",marginBottom:6}}>Data</div>
        <div style={{fontSize:12,color:"#71717a",marginBottom:14}}>All data is saved to your database and synced across devices.</div>
        <Btn variant="danger" onClick={clearData}>Clear All Data</Btn>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════ */
const ALL_TABS=["Dashboard","Buy","Inventory","Builds","Sell","History","Settings"];

/* ═══════════════════════════════════════════
   QUICK ACTIONS FAB — floating [+] button with a radial menu for Quick Buy / Quick Sell / Note.
   Deliberately minimal: no photos, no notes-on-purchase, just the fields needed to lock in a
   deal on the spot. Full detail (photos, condition notes, etc.) can be added later via Edit.
═══════════════════════════════════════════ */
function QuickActionsFab({state,dispatch,toast}) {
  const [open,setOpen]=useState(false);
  const [modal,setModal]=useState(null); // null | "buy" | "sell" | "note"

  const actions=[
    {key:"buy",icon:"🛒",label:"Quick Buy"},
    {key:"sell",icon:"💵",label:"Quick Sell"},
    {key:"note",icon:"📝",label:"Note"},
  ];

  return (
    <>
      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:899,background:"rgba(0,0,0,0.35)"}}/>}

      <div style={{position:"fixed",right:18,bottom:"calc(20px + env(safe-area-inset-bottom))",zIndex:900,
        display:"flex",flexDirection:"column",alignItems:"flex-end",gap:12}}>
        {open&&actions.map((a,i)=>(
          <button key={a.key} onClick={()=>{setModal(a.key);setOpen(false);}}
            style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",
              background:"#18181b",border:"1px solid #3f3f46",borderRadius:99,padding:"10px 16px 10px 14px",
              boxShadow:"0 6px 18px rgba(0,0,0,0.5)",animation:`fadeUp 0.18s ease ${(actions.length-1-i)*0.04}s both`}}>
            <span style={{fontSize:17}}>{a.icon}</span>
            <span style={{color:"#fff",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{a.label}</span>
          </button>
        ))}

        <button onClick={()=>setOpen(o=>!o)} style={{width:56,height:56,borderRadius:"50%",border:"none",cursor:"pointer",
          background:"#7c3aed",color:"#fff",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 8px 22px rgba(124,58,237,0.5)",transform:open?"rotate(45deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
          +
        </button>
      </div>

      {modal==="buy"&&<QuickBuyModal state={state} dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
      {modal==="sell"&&<QuickSellPickerModal state={state} dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
      {modal==="note"&&<QuickNoteModal dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
    </>
  );
}

function QuickBuyModal({state,dispatch,toast,onClose}) {
  const [name,setName]=useState("");
  const [cat,setCat]=useState("Other");
  const [cost,setCost]=useState("");

  const submit=()=>{
    if(!name||!cost){toast("Enter a name and cost","error");return;}
    const c=parseFloat(cost);
    dispatch({type:"ADD_PARTS",parts:[{id:uid(),name,category:cat,marketValue:c,allocatedCost:c,
      source:"Quick Buy",bundleId:null,status:"available",notes:"",soldTo:"",photoUrl:"",photoRecordId:"",
      history:[{date:today(),event:`Quick Buy — bought for ${fmt(c)}`}]}]});
    toast(`${name} added ✓ — add photos/details later via Edit`);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>🛒 Quick Buy</div>
        <div style={{fontSize:12,color:"#71717a",marginBottom:16}}>Lock it in fast — fill in the rest later.</div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <Inp label="Name" value={name} onChange={e=>setName(e.target.value)} placeholder="RX 580"/>
          <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={state.customCategories} dispatch={dispatch}/>
          <Inp label="Cost (₱)" type="number" value={cost} onChange={e=>setCost(e.target.value)} placeholder="3000"/>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn onClick={submit} style={{flex:1}}>Add to Inventory</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickSellPickerModal({state,dispatch,toast,onClose}) {
  const [search,setSearch]=useState("");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const items=[
    ...avail.map(p=>({id:p.id,name:p.name,cost:p.allocatedCost,mode:"part"})),
    ...builds.map(b=>({id:b.id,name:b.name,cost:state.parts.filter(p=>b.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0),mode:"build"})),
  ].filter(it=>!search||it.name.toLowerCase().includes(search.toLowerCase()));

  const selected=items.find(it=>it.id===selId);
  const sp=parseFloat(salePrice)||0;
  const profit=selected?sp-selected.cost:0;

  const submit=()=>{
    if(!selected||!salePrice){toast("Pick an item and enter a price","error");return;}
    dispatch({type:"SELL",mode:selected.mode,id:selected.id,sale:{id:uid(),
      partId:selected.mode==="part"?selected.id:null,buildId:selected.mode==="build"?selected.id:null,
      name:selected.name,cost:selected.cost,salePrice:sp,profit,buyerName:buyer,date:today()}});
    toast(`${selected.name} sold for ${fmt(sp)} — profit ${fmt(profit)} ✓`,profit>=0?"success":"warn");
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,maxHeight:"85vh",overflowY:"auto",animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>💵 Quick Sell</div>
        <div style={{fontSize:12,color:"#71717a",marginBottom:16}}>Find it, price it, done.</div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {!selected?(
            <>
              <Inp label="" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search parts and builds..."/>
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
                {items.length===0?(
                  <div style={{color:"#52525b",fontSize:13,padding:"10px 0"}}>Nothing available to sell.</div>
                ):items.map(it=>(
                  <button key={it.id} onClick={()=>setSelId(it.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    width:"100%",background:"#09090b",border:"1px solid #27272a",borderRadius:8,padding:"9px 12px",cursor:"pointer",textAlign:"left"}}>
                    <span style={{color:"#fff",fontSize:13}}>{it.mode==="build"?"🖥️ ":"🔧 "}{it.name}</span>
                    <span style={{fontFamily:"monospace",fontSize:12,color:"#71717a"}}>{fmt(it.cost)}</span>
                  </button>
                ))}
              </div>
            </>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#09090b",border:"1px solid #27272a",borderRadius:8,padding:"9px 12px"}}>
                <span style={{color:"#fff",fontSize:13}}>{selected.mode==="build"?"🖥️ ":"🔧 "}{selected.name}</span>
                <button onClick={()=>setSelId("")} style={{background:"none",border:"none",color:"#7dd3fc",fontSize:12,cursor:"pointer"}}>Change</button>
              </div>
              <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000"/>
              <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
              {sp>0&&(
                <div style={{fontSize:12,color:profit>=0?"#34d399":"#f87171",fontWeight:600}}>
                  {profit>=0?"+":""}{fmt(profit)} profit
                </div>
              )}
            </>
          )}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn variant="success" onClick={submit} disabled={!selected||!salePrice} style={{flex:1}}>Record Sale</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickNoteModal({dispatch,toast,onClose}) {
  const [text,setText]=useState("");
  const submit=()=>{
    if(!text.trim()){toast("Write something first","error");return;}
    dispatch({type:"ADD_QUICK_NOTE",text});
    toast("Note saved ✓");
    onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:4}}>📝 Quick Note</div>
        <div style={{fontSize:12,color:"#71717a",marginBottom:14}}>Jot it down — sort it out later. Shows on your Dashboard.</div>
        <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="Seller has 3 more GPUs, follow up Friday..."
          style={{width:"100%",minHeight:100,background:"#27272a",border:"1px solid #3f3f46",borderRadius:9,padding:"9px 11px",
            color:"#fff",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <Btn onClick={submit} style={{flex:1}}>Save Note</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ADD EXPENSE MODAL — log business costs (operation) or personal draws (owner's withdrawal),
   tracking each separately so personal draws feed into "Funds to Recover" and don't affect business P&L.
═══════════════════════════════════════════ */
function AddExpenseModal({onClose, dispatch, toast}) {
  const [wallet, setWallet] = useState("business");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if(!amt || !desc) return toast("Fill all fields", "error");
    const expenseType = wallet === "personal" ? "personal_draw" : "business";
    dispatch({type: "ADD_EXPENSE", wallet, expenseType, amount: amt, description: desc});
    toast(`Added ${wallet} expense for ${fmt(amt)} ✓`);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:16}}>Add Expense</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <Btn variant={wallet==="business"?"primary":"ghost"} onClick={()=>setWallet("business")} style={{flex:1}}>Business</Btn>
          <Btn variant={wallet==="personal"?"primary":"ghost"} onClick={()=>setWallet("personal")} style={{flex:1}}>Personal</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Tools, Lunch, Gas" />
          <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
        </div>
        <div style={{marginTop:16, display:"flex", gap:8}}>
          <Btn variant="danger" onClick={handleAdd} style={{flex:1}}>Log Expense</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state,setState]=useState(null);
  const [loadStatus,setLoadStatus]=useState("loading"); // loading | ready | error
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | error
  const saveTimer=useRef(null);
  const hasLoaded=useRef(false);

  // Load once from the server (which is backed by PocketBase)
  useEffect(()=>{
    fetch("/data")
      .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);return r.json();})
      .then(json=>{
        // Merge with initialState defaults rather than a straight replace, so any field added
        // after a user's data was first saved (customCategories, quickNotes, etc.) safely
        // defaults to its empty value instead of being undefined for existing saved data.
        const loadedState = json&&Object.keys(json).length?{...initialState,...json}:initialState;
        if(loadedState.businessCash===undefined && loadedState.liquidCash!==undefined) {
          loadedState.businessCash = loadedState.liquidCash;
        }
        setState(loadedState);
        setLoadStatus("ready");
        hasLoaded.current=true;
      })
      .catch(err=>{
        console.error("Failed to load data:",err);
        setLoadStatus("error");
      });
  },[]);

  const dispatch=useCallback(action=>setState(prev=>reducer(prev,action)),[]);

  // Debounced save to the server whenever state changes (skip the initial load)
  useEffect(()=>{
    if(!hasLoaded.current||state===null)return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)})
        .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);setSaveStatus("idle");})
        .catch(err=>{console.error("Failed to save data:",err);setSaveStatus("error");});
    },500);
    return()=>clearTimeout(saveTimer.current);
  },[state]);

  const [tab,setTab]=useState("Dashboard");
  const {toasts,toast}=useToast();
  const [theme,setTheme]=useState("dark");  // #9
  const [lightboxUrl,setLightboxUrl]=useState(null);
  const openLightbox=useCallback(url=>setLightboxUrl(url),[]);

  // Helper for chatbox to pre-fill form fields on AI commands
  const setFormData=useCallback((formType,data)=>{
    if(formType==="buy"){
      // These state variables are in the Buy component, so we dispatch to global state
      // For now, we just navigate and the user will need to fill manually OR we save to a temp location
      // A more elegant solution would be to store form defaults in global state
      // For this MVP, we just navigate to Buy tab and show a toast with the data
      toast(`${data.singleName} - Cost: ${data.singleCost}, Market: ${data.singleMarket}`, "info");
    }
  },[toast]);

  const pbUrl = import.meta.env.VITE_PB_URL || "http://localhost:8090";

  if(loadStatus==="loading"){
    return <div style={{minHeight:"100vh",background:"#09090b",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>Loading your data…</div>;
  }
  if(loadStatus==="error"){
    return (
      <div style={{minHeight:"100vh",background:"#09090b",color:"#fca5a5",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,fontFamily:"system-ui,sans-serif",padding:24,textAlign:"center"}}>
        <div style={{fontSize:18,fontWeight:700}}>Couldn't load your data</div>
        <div style={{fontSize:13,color:"#71717a",maxWidth:360}}>Check that the server is running and PocketBase is reachable, then refresh.</div>
      </div>
    );
  }

  const isDark=theme==="dark";
  const bg=isDark?"#09090b":"#f4f4f5";
  const surface=isDark?"#18181b":"#ffffff";
  const border=isDark?"#27272a":"#e4e4e7";
  const txt=isDark?"#fff":"#18181b";
  const sub=isDark?"#71717a":"#71717a";

  return (
    <div style={{minHeight:"100vh",background:bg,color:txt,fontFamily:"'Inter',system-ui,sans-serif",transition:"background 0.3s,color 0.3s"}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        html,body{background:${bg};margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${isDark?"#18181b":"#f4f4f5"}}
        ::-webkit-scrollbar-thumb{background:${isDark?"#3f3f46":"#d4d4d8"};border-radius:99px}
        input,select,textarea{font-size:16px;}
        @media (max-width:640px){
          .responsive-grid{grid-template-columns:1fr !important;gap:8px !important;}
          .part-row{grid-template-columns:1fr !important;gap:8px !important;}
          .header-stats{gap:10px !important;}
          .header-stats .stat-label{font-size:9px !important;}
          .tab-bar-inner button{padding:11px 11px !important;font-size:12.5px !important;}
        }
      `}</style>
      <ToastContainer toasts={toasts}/>

      {/* Header */}
      <div style={{borderBottom:`1px solid ${border}`,padding:"calc(13px + env(safe-area-inset-top)) 16px 13px",background:surface}}>
        <div style={{maxWidth:740,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flexShrink:0}}>
            <span style={{fontSize:20}}>🖥️</span>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:800,fontSize:14,color:txt,letterSpacing:"-0.02em",whiteSpace:"nowrap"}}>PC Trader</div>
              <div style={{fontSize:9,color:sub,letterSpacing:"0.06em",whiteSpace:"nowrap"}}>BUY · BUILD · SELL</div>
            </div>
          </div>
          <div className="header-stats" style={{display:"flex",gap:14,textAlign:"center",flexShrink:0}}>
            <div><div className="stat-label" style={{fontSize:10,color:sub}}>Parts</div>
              <div style={{fontFamily:"monospace",fontWeight:700,color:txt,fontSize:13}}><AnimNum value={state.parts.length}/></div></div>
            <div><div className="stat-label" style={{fontSize:10,color:sub}}>Profit</div>
              <div style={{fontFamily:"monospace",fontWeight:700,color:"#22c55e",fontSize:13}}>{fmt(state.sales.filter(s=>!s.deleted&&!s.returned).reduce((s,x)=>s+x.profit,0))}</div></div>
            <div><div className="stat-label" style={{fontSize:10,color:sub}}>Status</div>
              <div style={{fontSize:10.5,fontWeight:600,color:saveStatus==="saving"?"#eab308":saveStatus==="error"?"#ef4444":"#22c55e",whiteSpace:"nowrap"}}>
                {saveStatus==="saving"?"Saving…":saveStatus==="error"?"Save failed":"Synced ✓"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{borderBottom:`1px solid ${border}`,overflowX:"auto",background:surface,WebkitOverflowScrolling:"touch"}}>
        <div className="tab-bar-inner" style={{maxWidth:740,margin:"0 auto",display:"flex"}}>
          {ALL_TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"11px 14px",fontSize:13,fontWeight:500,border:"none",cursor:"pointer",background:"none",
              whiteSpace:"nowrap",transition:"all 0.15s",flexShrink:0,
              color:tab===t?"#a78bfa":sub,
              borderBottom:`2px solid ${tab===t?"#7c3aed":"transparent"}`,
            }}
              onMouseEnter={e=>{if(tab!==t)e.currentTarget.style.color=isDark?"#d4d4d8":"#18181b";}}
              onMouseLeave={e=>{if(tab!==t)e.currentTarget.style.color=sub;}}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Content — all tabs stay mounted (toggled with display:none) instead of being
          conditionally rendered, so an in-progress form (e.g. a half-typed Sell note) survives
          switching tabs and coming back. The previous `key={tab}` also forced a full remount of
          this entire wrapper on every switch, which alone was enough to wipe any local form state
          even before considering the per-tab && conditionals — removed for the same reason. */}
      <div style={{maxWidth:740,margin:"0 auto",padding:"22px 16px calc(40px + env(safe-area-inset-bottom))"}}>
        <div style={{display:tab==="Dashboard"?"block":"none"}}><Dashboard state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox}/></div>
        <div style={{display:tab==="Buy"?"block":"none"}}><Buy state={state} dispatch={dispatch} toast={toast}/></div>
        <div style={{display:tab==="Inventory"?"block":"none"}}><Inventory state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox}/></div>
        <div style={{display:tab==="Builds"?"block":"none"}}><Builds state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/></div>
        <div style={{display:tab==="Sell"?"block":"none"}}><Sell state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/></div>
        <div style={{display:tab==="History"?"block":"none"}}><History state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/></div>
        <div style={{display:tab==="Settings"?"block":"none"}}><Settings state={state} dispatch={dispatch} toast={toast} theme={theme} setTheme={setTheme}/></div>
      </div>

      <QuickActionsFab state={state} dispatch={dispatch} toast={toast}/>
      <AIAgentChatbox pbUrl={pbUrl} state={state} dispatch={dispatch} setTab={setTab} setFormData={setFormData} toast={toast}/>
      <Lightbox url={lightboxUrl} onClose={()=>setLightboxUrl(null)}/>
    </div>
  );
}
