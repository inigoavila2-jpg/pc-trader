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
  const [attempted,setAttempted]=useState(false);
  const numericAmount=Number(amount);
  const availableAmount=direction==="bank_to_cash"?businessBank:cashOnHand;
  const amountError=!numericAmount||numericAmount<=0?"Enter an amount greater than ₱0.":numericAmount>availableAmount?`Only ${fmt(availableAmount)} is available in this account.`:undefined;
  const handleTransfer=()=>{
    setAttempted(true);
    const amt=numericAmount;
    if(amountError)return toast(amountError,"error");
    dispatch({type:"TRANSFER_FUNDS",amount:amt,direction});
    toast(direction==="bank_to_cash"?`${fmt(amt)} withdrawn from Business Bank to Cash`:`${fmt(amt)} deposited from Cash to Business Bank`);
    onClose();
  };
  return (
    <ModalShell onClose={onClose} label="Transfer funds">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:6,fontFamily:FONT_DISPLAY}}>Transfer funds</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:14}}>Move money between your bank account and physical cash.</div>
      <Segmented ariaLabel="Transfer direction" value={direction} onChange={setDirection} options={[["bank_to_cash","Bank → Cash",Wallet],["cash_to_bank","Cash → Bank",Banknote]]}/>
      <div style={{marginTop:12}}><Inp label="Amount (₱)" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" error={attempted?amountError:undefined}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10}}><div style={{fontSize:10,color:t.textFaint}}>Business Bank</div><div style={{fontFamily:FONT_MONO,fontSize:13,fontWeight:700,color:t.text,marginTop:3}}>{fmt(businessBank)}</div></div>
        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10}}><div style={{fontSize:10,color:t.textFaint}}>Cash</div><div style={{fontFamily:FONT_MONO,fontSize:13,fontWeight:700,color:t.text,marginTop:3}}>{fmt(cashOnHand)}</div></div>
      </div>
      {numericAmount>0&&numericAmount<=availableAmount&&<div style={{marginTop:10,padding:"10px 12px",borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`,fontSize:12,color:t.textMuted}}>
        After transfer: {direction==="bank_to_cash"?`Bank ${fmt(businessBank-numericAmount)} · Cash ${fmt(cashOnHand+numericAmount)}`:`Bank ${fmt(businessBank+numericAmount)} · Cash ${fmt(cashOnHand-numericAmount)}`}
      </div>}
      <div style={{marginTop:16,display:"flex",gap:8}}><Btn variant="success" icon={ArrowLeftRight} onClick={handleTransfer} style={{flex:1}}>Confirm transfer</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
    </ModalShell>
  );
}
