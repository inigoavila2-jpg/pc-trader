import { useState } from "react";

import { Undo2 } from "lucide-react";

import { FONT_DISPLAY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Builds } from "../pages/Builds.jsx";

export function ReturnReasonModal({title,sale,onConfirm,onCancel}) {
  const t=useTheme();
  const [reason,setReason]=useState("Buyer cancelled");
  const [other,setOther]=useState("");
  const [buildDisposition,setBuildDisposition]=useState("reactivate");
  const reasons=["Buyer cancelled","Product returned","Incorrect sale entry","Other"];
  const isBuildSale=!!sale.buildId;
  return (
    <ModalShell onClose={onCancel} label={title}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:6,fontFamily:FONT_DISPLAY}}>{title}</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:16,lineHeight:1.5}}>
        {isBuildSale
          ? `"${sale.name}" was sold as a build. The sale and profit/loss will be reversed either way — choose what happens to the build below.`
          : `"${sale.name}" will be returned to inventory and the profit/loss reversed.`}
      </div>
      <div role="radiogroup" aria-label="Reason" style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {reasons.map(r=>(
          <label key={r} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"8px 10px",borderRadius:8,
            border:`1px solid ${reason===r?t.accentSoftBorder:t.border}`,background:reason===r?t.accentSoft:"transparent"}}>
            <input type="radio" name="return-reason" checked={reason===r} onChange={()=>setReason(r)} style={{accentColor:t.accent}}/>
            <span style={{color:t.text,fontSize:13}}>{r}</span>
          </label>
        ))}
      </div>
      {reason==="Other"&&<Inp label="Specify reason" value={other} onChange={e=>setOther(e.target.value)} placeholder="What happened?"/>}

      {isBuildSale&&(
        <div style={{marginTop:14}}>
          <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:8}}>What should happen to the build?</div>
          <div role="radiogroup" aria-label="Build disposition" style={{display:"flex",flexDirection:"column",gap:7}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"10px",borderRadius:8,
              border:`1px solid ${buildDisposition==="reactivate"?t.accentSoftBorder:t.border}`,background:buildDisposition==="reactivate"?t.accentSoft:"transparent"}}>
              <input type="radio" name="build-disposition" checked={buildDisposition==="reactivate"} onChange={()=>setBuildDisposition("reactivate")} style={{accentColor:t.accent,marginTop:2}}/>
              <span>
                <span style={{color:t.text,fontSize:13,display:"block"}}>Put it back in Builds</span>
                <span style={{color:t.textFaint,fontSize:11}}>The PC is still assembled — make it sellable again as one unit.</span>
              </span>
            </label>
            <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"10px",borderRadius:8,
              border:`1px solid ${buildDisposition==="disassemble"?t.accentSoftBorder:t.border}`,background:buildDisposition==="disassemble"?t.accentSoft:"transparent"}}>
              <input type="radio" name="build-disposition" checked={buildDisposition==="disassemble"} onChange={()=>setBuildDisposition("disassemble")} style={{accentColor:t.accent,marginTop:2}}/>
              <span>
                <span style={{color:t.text,fontSize:13,display:"block"}}>Disassemble into inventory</span>
                <span style={{color:t.textFaint,fontSize:11}}>Break the build apart — each part becomes individually available.</span>
              </span>
            </label>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
        <Btn variant="warn" icon={Undo2} onClick={()=>onConfirm(reason==="Other"?(other||"Other"):reason,isBuildSale?buildDisposition:undefined)} style={{width:"100%"}}>Confirm undo</Btn>
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}
