import { useState } from "react";

import { Banknote, ArrowLeftRight, Wallet } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Segmented } from "./Segmented.jsx";

export function TransferModal({onClose,dispatch,toast,businessBank,cashOnHand}) {
  const t=useTheme();
  const [amount,setAmount]=useState("");
  const [direction,setDirection]=useState("bank_to_cash");
  const handleTransfer=()=>{
    const amt=Number(amount);
    if(!amt||amt<=0)return toast("Enter a valid amount","error");
    if(direction==="bank_to_cash"&&amt>businessBank)return toast("Insufficient Business Bank funds","error");
    if(direction==="cash_to_bank"&&amt>cashOnHand)return toast("Insufficient Cash on hand","error");
    dispatch({type:"TRANSFER_FUNDS",amount:amt,direction});
    toast(direction==="bank_to_cash"?`${fmt(amt)} withdrawn from Business Bank to Cash`:`${fmt(amt)} deposited from Cash to Business Bank`);
    onClose();
  };
  return (
    <ModalShell onClose={onClose} label="Transfer funds">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:6,fontFamily:FONT_DISPLAY}}>Transfer funds</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:14}}>Move money between your bank account and physical cash.</div>
      <Segmented ariaLabel="Transfer direction" value={direction} onChange={setDirection} options={[["bank_to_cash","Bank → Cash",Wallet],["cash_to_bank","Cash → Bank",Banknote]]}/>
      <div style={{marginTop:12}}><Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10}}><div style={{fontSize:10,color:t.textFaint}}>Business Bank</div><div style={{fontFamily:FONT_MONO,fontSize:13,fontWeight:700,color:t.text,marginTop:3}}>{fmt(businessBank)}</div></div>
        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10}}><div style={{fontSize:10,color:t.textFaint}}>Cash</div><div style={{fontFamily:FONT_MONO,fontSize:13,fontWeight:700,color:t.text,marginTop:3}}>{fmt(cashOnHand)}</div></div>
      </div>
      <div style={{marginTop:16,display:"flex",gap:8}}><Btn variant="success" icon={ArrowLeftRight} onClick={handleTransfer} style={{flex:1}}>Confirm transfer</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
    </ModalShell>
  );
}
