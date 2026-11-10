import { useState, useRef } from "react";

import { X, Camera, Loader2, Sparkles } from "lucide-react";

import { FONT_BODY, useTheme } from "./theme.js";
import { SR_ONLY } from "./SR_ONLY.jsx";
import { fileToDataUrl, compressImage } from "./mediaUtils.js";

export function PhotoUpload({photoUrl,photoRecordId,onChange,label="Photo",onAnalyze}) {
  const t=useTheme();
  const [status,setStatus]=useState("idle");
  const inputRef=useRef(null);

  const handleFile=async(file)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){setStatus("error");return;}
    setStatus("compressing");
    try{
      const compressed=await compressImage(file).catch(()=>file);
      const analysisPromise=onAnalyze
        ? fileToDataUrl(compressed).then(dataUrl=>onAnalyze(dataUrl,compressed)).catch(err=>{
            console.error("AI image analysis failed:",err);
            return null;
          })
        : Promise.resolve(null);

      setStatus("uploading");
      const form=new FormData();
      form.append("photo",compressed);
      const res=await fetch("/photo",{method:"POST",body:form});
      if(!res.ok)throw new Error(`Upload failed (${res.status})`);
      const {url,recordId}=await res.json();
      if(photoRecordId){fetch(`/photo/${photoRecordId}`,{method:"DELETE"}).catch(()=>{});}
      onChange({photoUrl:url,photoRecordId:recordId});

      if(onAnalyze){
        setStatus("analyzing");
        await analysisPromise;
      }
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
      {label&&<div style={{fontSize:12.5,color:t.textMuted,marginBottom:6,fontWeight:500}}>{label}</div>}
      <input ref={inputRef} type="file" accept="image/*" style={SR_ONLY}
        onChange={e=>handleFile(e.target.files?.[0])} aria-label={label||"Upload photo"}/>
      {photoUrl?(
        <div style={{position:"relative",display:"inline-block"}}>
          <img src={photoUrl} alt="" style={{width:96,height:96,objectFit:"cover",borderRadius:10,border:`1px solid ${t.border}`,display:"block"}}/>
          <button onClick={removePhoto} type="button" aria-label="Remove photo" className="bl-focusable"
            style={{position:"absolute",top:-9,right:-9,width:28,height:28,borderRadius:"50%",
            background:t.negativeStrong,border:`2px solid ${t.bg}`,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <X size={14} strokeWidth={2.5}/>
          </button>
        </div>
      ):(
        <button type="button" onClick={()=>inputRef.current?.click()} disabled={status==="uploading"||status==="compressing"||status==="analyzing"} className="bl-focusable"
          style={{width:96,height:96,borderRadius:10,border:`1.5px dashed ${t.borderStrong}`,background:t.surfaceSunken,color:t.textMuted,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:(status==="uploading"||status==="compressing"||status==="analyzing")?"wait":"pointer",
            fontSize:11,fontFamily:FONT_BODY,transition:"border-color 0.15s,color 0.15s"}}
          onMouseEnter={e=>{if(status==="idle"){e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.accent;}}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=t.borderStrong;e.currentTarget.style.color=t.textMuted;}}>
          {status==="compressing"?(
            <><Loader2 size={18} className="bl-spin"/><span>Optimizing…</span></>
          ):status==="uploading"?(
            <><Loader2 size={18} className="bl-spin"/><span>Uploading…</span></>
          ):status==="analyzing"?(
            <><Sparkles size={18} className="bl-spin"/><span>AI analyzing…</span></>
          ):(
            <><Camera size={20} strokeWidth={1.75}/><span>Add photo</span></>
          )}
        </button>
      )}
      {status==="error"&&<div style={{color:t.negative,fontSize:11.5,marginTop:6}}>Upload failed — try again</div>}
    </div>
  );
}

