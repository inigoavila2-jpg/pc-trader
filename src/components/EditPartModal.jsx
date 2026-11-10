import { useState } from "react";


import { fmt } from "../data/model.js";
import { FONT_DISPLAY, useTheme } from "./theme.js";
import { PhotoUpload } from "./PhotoUpload.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { CategoryPicker } from "./CategoryPicker.jsx";

export function EditPartModal({part,onClose,onSave,dispatch,customCategories,hiddenCategories=[]}) {
  const t=useTheme();
  const [name,setName]=useState(part.name);
  const [cat,setCat]=useState(part.category);
  const [cost,setCost]=useState(String(part.allocatedCost));
  const [market,setMarket]=useState(String(part.marketValue));
  const [notes,setNotes]=useState(part.notes||"");
  const [photo,setPhoto]=useState({photoUrl:part.photoUrl||"",photoRecordId:part.photoRecordId||""});
  return (
    <ModalShell onClose={onClose} label="Edit part" maxWidth={420}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:16,fontFamily:FONT_DISPLAY}}>Edit part</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <PhotoUpload label="Photo" photoUrl={photo.photoUrl} photoRecordId={photo.photoRecordId} onChange={setPhoto}/>
        <Inp label="Name" value={name} onChange={e=>setName(e.target.value)}/>
        <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={customCategories} hiddenCategories={hiddenCategories} dispatch={dispatch}/>
        <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Cost (₱)" type="number" value={cost} onChange={e=>setCost(e.target.value)}/>
          <Inp label="Market value (₱)" type="number" value={market} onChange={e=>setMarket(e.target.value)}/>
        </div>
        <Inp label="Notes (condition, extras, etc.)" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tested working, fan slightly loud"/>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={()=>onSave({name,category:cat,allocatedCost:parseFloat(cost)||part.allocatedCost,marketValue:parseFloat(market)||part.marketValue,notes,photoUrl:photo.photoUrl,photoRecordId:photo.photoRecordId},`cost→${fmt(parseFloat(cost)||part.allocatedCost)}`)} style={{flex:1}}>Save changes</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}
