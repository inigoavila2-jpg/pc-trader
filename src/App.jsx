import { useState, useEffect, useRef, useCallback } from "react";

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
const TABS = ["Dashboard","Buy","Inventory","Builds","Sell","History"];
const initialState = { bundles:[], parts:[], builds:[], sales:[], settings:{ targetMargin:30 } };

/* ═══════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════ */
function reducer(state, action) {
  switch(action.type) {
    case "ADD_BUNDLE":
      return {...state, bundles:[...state.bundles,action.bundle], parts:[...state.parts,...action.parts]};
    case "ADD_PARTS":
      return {...state, parts:[...state.parts,...action.parts]};
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
          parts: state.parts.map(p=>p.id===id
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)} — profit ${fmt(sale.profit)}`}]}
            : p
          )};
      } else {
        const build = state.builds.find(b=>b.id===id);
        return {...state, sales:[...state.sales,sale],
          builds: state.builds.map(b=>b.id===id?{...b,sold:true}:b),
          parts: state.parts.map(p=>build?.partIds.includes(p.id)
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold in build "${build.name}" to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)}`}]}
            : p
          )};
      }
    }
    case "SET_SETTING":
      return {...state, settings:{...state.settings,[action.key]:action.value}};

    case "DELETE_PART":
      return {...state, parts: state.parts.filter(p=>p.id!==action.id)};

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
  // extraChoices: optional array of {label, onClick} rendered as additional buttons
  // (used for the bundle-delete "delete parts too vs keep loose" choice)
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#18181b",border:"1px solid #3f3f46",borderRadius:16,padding:22,width:"100%",maxWidth:380,animation:"fadeUp 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:"#a1a1aa",marginBottom:18,lineHeight:1.5}}>{message}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {extraChoices?extraChoices.map((c,i)=>(
            <Btn key={i} variant={i===0?"danger":"warn"} onClick={c.onClick} style={{width:"100%"}}>{c.label}</Btn>
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
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:"#a1a1aa"}}>
      {label}
      <input {...props} onFocus={e=>{setF(true);props.onFocus?.(e);}} onBlur={e=>{setF(false);props.onBlur?.(e);}}
        style={{background:"#27272a",border:`1px solid ${error?"#ef4444":f?"#7c3aed":"#3f3f46"}`,borderRadius:9,
          padding:"8px 11px",color:"#fff",fontSize:13,outline:"none",
          boxShadow:f?"0 0 0 3px rgba(124,58,237,0.15)":"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",...(props.style||{})}} />
      {error&&<span style={{color:"#f87171",fontSize:11}}>{error}</span>}
    </label>
  );
}

function Sel({label,children,...props}) {
  const [f,setF]=useState(false);
  return (
    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:"#a1a1aa"}}>
      {label}
      <select {...props} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{background:"#27272a",border:`1px solid ${f?"#7c3aed":"#3f3f46"}`,borderRadius:9,
          padding:"8px 11px",color:"#fff",fontSize:13,outline:"none",
          boxShadow:f?"0 0 0 3px rgba(124,58,237,0.15)":"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box"}}>
        {children}
      </select>
    </label>
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
function EditPartModal({part,onClose,onSave}) {
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
          <Sel label="Category" value={cat} onChange={e=>setCat(e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </Sel>
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
   DASHBOARD  (#6 capital at risk, #7 bundle P&L)
═══════════════════════════════════════════ */
function Dashboard({state,setTab,openLightbox}) {
  const {parts,sales,bundles}=state;
  const totalCapital=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const totalRevenue=sales.reduce((s,x)=>s+x.salePrice,0);
  const totalCOGS=sales.reduce((s,x)=>s+x.cost,0);
  const totalProfit=totalRevenue-totalCOGS;
  const roi=totalCOGS>0?totalProfit/totalCOGS:0;
  // Defective parts are a realized loss already counted in totalProfit (via their write-off sale),
  // so they're excluded from "at risk" — that stat is only for capital still tied up in active inventory.
  const atRisk=parts.filter(p=>p.status!=="sold"&&p.status!=="defective").reduce((s,p)=>s+p.allocatedCost,0);
  const recovered=parts.filter(p=>p.status==="sold").reduce((s,p)=>s+p.allocatedCost,0);
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
      <div>
        <h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Overview</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Live figures from your inventory.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        <StatBox label="Total Profit" value={fmt(totalProfit)} color={totalProfit>=0?"#34d399":"#f87171"} sub={`ROI ${pct(roi)}`}/>
        <StatBox label="Total Revenue" value={fmt(totalRevenue)} color="#34d399"/>
        <StatBox label="Capital at Risk" value={fmt(atRisk)} color="#f59e0b" sub="locked in unsold parts"/>
        <StatBox label="Capital Recovered" value={fmt(recovered)} sub={`${parts.length>0?Math.round(recovered/totalCapital*100):0}% of total`}/>
        {avgDaysToSell!==null&&<StatBox label="Avg. Days to Sell" value={`${avgDaysToSell}d`} color="#38bdf8" sub={`across ${holdDurations.length} sold part${holdDurations.length===1?"":"s"}`}/>}
        {writeOffCount>0&&<StatBox label="Write-offs" value={fmt(-writeOffLoss)} color="#f87171" sub={`${writeOffCount} defective part${writeOffCount===1?"":"s"}`}/>}
      </div>

      {/* Capital at risk bar  (#6) */}
      {totalCapital>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",marginBottom:8}}>CAPITAL RECOVERY</div>
          <div style={{height:8,background:"#27272a",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(recovered/totalCapital*100,100)}%`,background:"linear-gradient(90deg,#7c3aed,#34d399)",borderRadius:99,transition:"width 0.8s cubic-bezier(0.34,1.2,0.64,1)"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:"#71717a"}}>
            <span>Recovered {fmt(recovered)}</span><span>Total {fmt(totalCapital)}</span>
          </div>
        </Card>
      )}

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
                  <Sel label={idx===0?"Cat":"."} value={row.category} onChange={e=>updateRow(row.id,"category",e.target.value)} style={{minWidth:90}}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </Sel>
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
            <Sel label="Category" value={singleCat} onChange={e=>setSingleCat(e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </Sel>
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
function Inventory({state,dispatch,toast,setTab,openLightbox}) {
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");   // #8
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

  const isBundleView=filter==="bundle";
  const filtered=isBundleView?[]:parts.filter(p=>{
    if(filter!=="all"&&p.status!==filter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.category.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const handleQuickSell=(sp,buyer)=>{
    if(!quickSell)return;
    const p=quickSell;
    const sale={id:uid(),partId:p.id,name:p.name,cost:p.allocatedCost,salePrice:sp,profit:sp-p.allocatedCost,buyerName:buyer,date:today()};
    dispatch({type:"SELL",mode:"part",id:p.id,sale});
    toast(`${p.name} sold for ${fmt(sp)} — profit ${fmt(sp-p.allocatedCost)} ✓`,sp-p.allocatedCost>=0?"success":"warn");
    setQuickSell(null);
  };

  const handleEdit=(changes,desc)=>{
    dispatch({type:"UPDATE_PART",id:editing.id,changes,desc});
    toast(`${editing.name} updated ✓`);
    setEditing(null);
  };

  const confirmDelete=()=>{
    if(deleting._isBundle){
      // handled by the dual-choice modal instead — this path shouldn't fire for bundles
      return;
    }
    dispatch({type:"DELETE_PART",id:deleting.id});
    toast(`${deleting.name} deleted`,"warn");
    setDeleting(null);
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
    setDefectiveTarget(null);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {quickSell&&<QuickSellModal part={quickSell} onClose={()=>setQuickSell(null)} onConfirm={handleQuickSell} targetMargin={settings?.targetMargin||30}/>}
      {editing&&<EditPartModal part={editing} onClose={()=>setEditing(null)} onSave={handleEdit}/>}
      {deleting&&!deleting._isBundle&&(
        <ConfirmModal title="Delete this part?" message={`"${deleting.name}" will be permanently removed. This can't be undone.`}
          onConfirm={confirmDelete} onCancel={()=>setDeleting(null)}/>
      )}
      {deleting&&deleting._isBundle&&(
        <ConfirmModal title="Delete this bundle?" message={`What should happen to the parts that came from "${deleting.name}"?`}
          onCancel={()=>setDeleting(null)}
          extraChoices={[
            {label:"Delete bundle + all its parts",onClick:deleteBundleWithParts},
            {label:"Keep parts as loose inventory",onClick:deleteBundleKeepParts},
          ]}/>
      )}
      {defectiveTarget&&(
        <DefectiveModal part={defectiveTarget} onConfirm={confirmDefective} onCancel={()=>setDefectiveTarget(null)}/>
      )}

      <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>Inventory</h2>
        <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>{parts.length} parts tracked</p></div>

      {/* Search  (#8) */}
      {!isBundleView&&<Inp label="" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search by name or category..."/>}

      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {["all","available","in_build","sold","defective","bundle"].map(f=>(
          <Btn key={f} variant={filter===f?"primary":"ghost"} onClick={()=>setFilter(f)}>
            {f==="all"?"All":f==="bundle"?"📦 Bundles":f.replace("_"," ")}
            {f!=="bundle"&&(
              <span style={{background:"#3f3f46",borderRadius:99,padding:"1px 6px",fontSize:11,color:"#a1a1aa",marginLeft:2}}>
                {f==="all"?parts.length:parts.filter(p=>p.status===f).length}
              </span>
            )}
          </Btn>
        ))}
      </div>

      {isBundleView?(
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
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:9,fontSize:12}}>
                        <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length} onClick={p.photoUrl?()=>openLightbox(p.photoUrl):undefined}/>
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
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((p,i)=>{
            const inBuildName=buildNameFor(p);
            return (
            <div key={p.id} style={{background:"#18181b",border:"1px solid #27272a",borderRadius:12,padding:14,
              animation:`fadeUp 0.2s ease ${i*0.03}s both`,transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#52525b"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#27272a"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:11,flex:1,minWidth:0}}>
                  <PhotoThumb url={p.photoUrl} seed={i} onClick={p.photoUrl?()=>openLightbox(p.photoUrl):undefined}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{color:"#fff",fontWeight:600,fontSize:14}}>{p.name}</span>
                      <span style={{background:"#27272a",color:"#a1a1aa",fontSize:10,padding:"2px 6px",borderRadius:5}}>{p.category}</span>
                      <Badge s={p.status}/>
                    </div>
                    <div style={{color:"#71717a",fontSize:11}}>{p.source}</div>
                    {/* Status detail: which build this part is currently in */}
                    {inBuildName&&<div style={{color:"#7dd3fc",fontSize:11,marginTop:2}}>Status: Used in {inBuildName}</div>}
                    {/* Notes  (#3) */}
                    {p.notes&&<div style={{color:"#a1a1aa",fontSize:11,marginTop:3,fontStyle:"italic"}}>📝 {p.notes}</div>}
                    {/* Buyer  (#10) */}
                    {p.soldTo&&<div style={{color:"#71717a",fontSize:11,marginTop:2}}>Sold to: {p.soldTo}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:14,textAlign:"right",flexShrink:0}}>
                  {[["Cost",fmt(p.allocatedCost),"#fff"],["Market",fmt(p.marketValue),"#d4d4d8"],
                    ["Potential",fmt(p.marketValue-p.allocatedCost),p.marketValue-p.allocatedCost>=0?"#34d399":"#f87171"]
                  ].map(([l,v,c])=>(
                    <div key={l}><div style={{fontSize:10,color:"#71717a"}}>{l}</div>
                      <div style={{fontFamily:"monospace",fontSize:12,color:c,fontWeight:600}}>{v}</div></div>
                  ))}
                </div>
              </div>
              {/* Action buttons  (#1 quick sell, #2 edit, delete, defective) */}
              <div style={{display:"flex",gap:7,marginTop:11,borderTop:"1px solid #27272a",paddingTop:11,flexWrap:"wrap"}}>
                {p.status==="available"&&<Btn small variant="success" onClick={()=>setQuickSell(p)}>⚡ Quick Sell</Btn>}
                <Btn small variant="ghost" onClick={()=>setEditing(p)}>✏️ Edit</Btn>
                {p.status!=="sold"&&p.status!=="defective"&&(
                  <Btn small variant="warn" onClick={()=>setDefectiveTarget(p)}>⚠️ Defective</Btn>
                )}
                <Btn small variant="danger" onClick={()=>setDeleting(p)}>🗑 Delete</Btn>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BUILDS
═══════════════════════════════════════════ */
function Builds({state,dispatch,toast,openLightbox}) {
  const [creating,setCreating]=useState(false);
  const [buildName,setBuildName]=useState("");
  const [sel,setSel]=useState([]);
  const [buildPhoto,setBuildPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [deletingBuild,setDeletingBuild]=useState(null);
  const avail=state.parts.filter(p=>p.status==="available");
  const buildCost=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0);
  const buildMarket=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.marketValue,0);
  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const submit=()=>{
    if(!buildName||sel.length===0){toast("Name the build and pick parts","error");return;}
    dispatch({type:"CREATE_BUILD",build:{id:uid(),name:buildName,partIds:sel,date:today(),photoUrl:buildPhoto.photoUrl,photoRecordId:buildPhoto.photoRecordId}});
    toast(`Build "${buildName}" created ✓`);
    setBuildName("");setSel([]);setCreating(false);setBuildPhoto({photoUrl:"",photoRecordId:""});
  };
  const dissolve=b=>{dispatch({type:"DISSOLVE_BUILD",buildId:b.id});toast(`"${b.name}" dissolved — parts returned`);};
  const confirmDeleteBuild=()=>{
    dispatch({type:"DELETE_BUILD",buildId:deletingBuild.id,returnParts:false});
    toast(`"${deletingBuild.name}" deleted`,"warn");
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
        <ConfirmModal title="Delete this build?" message={`"${deletingBuild.name}" will be permanently deleted. Its parts will be deleted too — they will NOT be returned to inventory. Use "Dissolve" instead if you want to keep the parts.`}
          onConfirm={confirmDeleteBuild} onCancel={()=>setDeletingBuild(null)}/>
      )}
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
          <div style={{fontSize:12,color:"#a1a1aa",margin:"12px 0 8px"}}>Select parts:</div>
          {avail.length===0?<div style={{color:"#52525b",fontSize:13}}>No available parts.</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {avail.map(p=>{
                const checked=sel.includes(p.id);
                return (
                  <label key={p.id} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",
                    background:checked?"rgba(124,58,237,0.1)":"transparent",
                    border:`1px solid ${checked?"#7c3aed":"#27272a"}`,borderRadius:8,padding:"7px 11px",transition:"all 0.12s"}}>
                    <input type="checkbox" checked={checked} onChange={()=>toggle(p.id)} style={{accentColor:"#7c3aed"}}/>
                    <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length}/>
                    <span style={{color:"#fff",fontSize:13,flex:1}}>{p.name}</span>
                    <span style={{background:"#27272a",color:"#a1a1aa",fontSize:10,padding:"2px 6px",borderRadius:4}}>{p.category}</span>
                    <span style={{fontFamily:"monospace",fontSize:11,color:"#d4d4d8"}}>{fmt(p.allocatedCost)}</span>
                  </label>
                );
              })}
            </div>
          )}
          {/* Live running cost tally (#"component cost roll-up") */}
          {sel.length>0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #27272a"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                <span style={{color:"#a1a1aa"}}>Build cost so far ({sel.length} part{sel.length===1?"":"s"})</span><span style={{fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{fmt(buildCost)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#a1a1aa"}}>Market value</span><span style={{fontFamily:"monospace",color:"#d4d4d8"}}>{fmt(buildMarket)}</span>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <Btn onClick={submit} disabled={!buildName||sel.length===0}>Save Build</Btn>
            <Btn variant="ghost" onClick={()=>{setCreating(false);setSel([]);setBuildName("");}}>Cancel</Btn>
          </div>
        </Card>
      )}

      {state.builds.filter(b=>!b.dissolved&&!b.sold).length===0&&!creating?(
        <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No active builds.</div></Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {state.builds.filter(b=>!b.dissolved&&!b.sold).map(build=>{
            const bp=state.parts.filter(p=>build.partIds.includes(p.id));
            const cost=bp.reduce((s,p)=>s+p.allocatedCost,0);
            const market=bp.reduce((s,p)=>s+p.marketValue,0);
            return (
              <Card key={build.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:10}}>
                  <div style={{display:"flex",gap:11,minWidth:0}}>
                    {build.photoUrl&&<PhotoThumb url={build.photoUrl} size={56} seed={build.id.length} onClick={()=>openLightbox(build.photoUrl)}/>}
                    <div><div style={{color:"#fff",fontWeight:600,fontSize:14}}>{build.name}</div>
                      <div style={{color:"#71717a",fontSize:11,marginTop:2}}>{build.date} · {bp.length} parts</div></div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{fmt(cost)}</div>
                    <div style={{fontSize:10,color:"#71717a"}}>market {fmt(market)}</div>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                  {bp.map(p=>(
                    <span key={p.id} style={{background:"#27272a",border:"1px solid #3f3f46",borderRadius:5,fontSize:11,padding:"2px 7px",color:"#d4d4d8"}}>
                      {p.name} <span style={{color:"#71717a"}}>{fmt(p.allocatedCost)}</span>
                    </span>
                  ))}
                </div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  <Btn small variant="ghost" onClick={()=>dissolve(build)}>Dissolve Build</Btn>
                  <Btn small variant="ghost" onClick={()=>copySpecs(build,bp)}>📋 Copy Specs for Listing</Btn>
                  <Btn small variant="danger" onClick={()=>setDeletingBuild(build)}>🗑 Delete</Btn>
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
  const [loading,setLoading]=useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  const targetMargin=state.settings?.targetMargin||30;

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const tp=avail.find(p=>p.id===selId);
  const tb=builds.find(b=>b.id===selId);
  const cost=mode==="part"?tp?.allocatedCost||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
  const suggested=cost>0?Math.round(cost*(1+targetMargin/100)):0;  // #5
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
      dispatch({type:"SELL",mode,id:selId,sale:{id:uid(),partId:mode==="part"?selId:null,name,cost,salePrice:sp,profit,buyerName:buyer,date:today()}});
      toast(`${name} sold for ${fmt(sp)} — profit ${fmt(profit)} ✓`,profit>=0?"success":"warn");
      setSelId("");setSalePrice("");setBuyer("");setLoading(false);
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
          {/* Photo-enabled picker — a native <select> can't render images, so this is a custom dropdown */}
          <div>
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
              <div style={{marginTop:6,border:"1px solid #27272a",borderRadius:9,overflow:"hidden",maxHeight:280,overflowY:"auto",animation:"fadeUp 0.15s ease"}}>
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
            )}
          </div>
          {/* Price suggestion  (#5) */}
          {selId&&cost>0&&(
            <div style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.25)",borderRadius:9,padding:"9px 12px",fontSize:12,color:"#a78bfa",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Suggested price at {targetMargin}% margin</span>
              <button onClick={()=>setSalePrice(String(suggested))} style={{background:"#7c3aed",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                Use {fmt(suggested)}
              </button>
            </div>
          )}
          <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000"/>
          {/* Buyer name  (#10) */}
          <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
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
function History({state,openLightbox}) {
  const [sel,setSel]=useState("");
  const part=state.parts.find(p=>p.id===sel);

  // #4 Export CSV
  const exportCSV=()=>{
    const rows=[["Name","Category","Source","Cost","Market Value","Status","Sale Price","Profit","Buyer","Date"]];
    state.parts.forEach(p=>{
      const sale=state.sales.find(s=>s.partId===p.id)||state.sales.find(s=>s.name===p.name);
      rows.push([p.name,p.category,p.source,p.allocatedCost,p.marketValue,p.status,sale?sale.salePrice:"",sale?sale.profit:"",sale?sale.buyerName||"":"",sale?.date||""]);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`pc-trader-${today().replace(/\s/g,"-")}.csv`;a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:0}}>History</h2>
          <p style={{color:"#71717a",fontSize:13,margin:"4px 0 0"}}>Part movement log + data export.</p></div>
        {/* CSV Export  (#4) */}
        <Btn variant="ghost" onClick={exportCSV} disabled={state.parts.length===0}>⬇ Export CSV</Btn>
      </div>

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

      {/* Sales summary */}
      {state.sales.length>0&&(
        <Card>
          <div style={{fontSize:11,color:"#71717a",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>All Sales</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...state.sales].reverse().map(s=>(
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #27272a"}}>
                <div>
                  <div style={{color:"#fff",fontSize:13,fontWeight:500}}>{s.name}</div>
                  <div style={{color:"#71717a",fontSize:10}}>{s.date}{s.buyerName?` · ${s.buyerName}`:""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"monospace",fontSize:13,color:"#fff"}}>{fmt(s.salePrice)}</div>
                  <div style={{fontFamily:"monospace",fontSize:11,color:s.profit>=0?"#34d399":"#f87171"}}>{s.profit>=0?"+":""}{fmt(s.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {state.parts.length===0&&(
        <Card style={{textAlign:"center",padding:36}}><div style={{color:"#52525b"}}>No parts yet.</div></Card>
      )}
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
        setState(json&&Object.keys(json).length?json:initialState);
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
              <div style={{fontFamily:"monospace",fontWeight:700,color:"#22c55e",fontSize:13}}>{fmt(state.sales.reduce((s,x)=>s+x.profit,0))}</div></div>
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

      {/* Content */}
      <div key={tab} style={{maxWidth:740,margin:"0 auto",padding:"22px 16px calc(40px + env(safe-area-inset-bottom))",animation:"fadeUp 0.22s ease"}}>
        {tab==="Dashboard" && <Dashboard state={state} setTab={setTab} openLightbox={openLightbox}/>}
        {tab==="Buy"       && <Buy state={state} dispatch={dispatch} toast={toast}/>}
        {tab==="Inventory" && <Inventory state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox}/>}
        {tab==="Builds"    && <Builds state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/>}
        {tab==="Sell"      && <Sell state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/>}
        {tab==="History"   && <History state={state} openLightbox={openLightbox}/>}
        {tab==="Settings"  && <Settings state={state} dispatch={dispatch} toast={toast} theme={theme} setTheme={setTheme}/>}
      </div>

      <Lightbox url={lightboxUrl} onClose={()=>setLightboxUrl(null)}/>
    </div>
  );
}
