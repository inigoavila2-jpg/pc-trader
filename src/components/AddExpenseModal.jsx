import { useState } from "react";

import { Banknote, Minus, Wallet } from "lucide-react";
import { fmt, accountLabel } from "../data/model.js";
import { FONT_DISPLAY, useTheme } from "./theme.js";
import { usePersistentState } from "../hooks/appHooks.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Segmented } from "./Segmented.jsx";

export function AddExpenseModal({onClose,dispatch,toast}) {
  const t=useTheme();
  const [account,setAccount]=usePersistentState("pctrader:lastExpenseAccount","bank");
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [attempted,setAttempted]=useState(false);
  const numericAmount=Number(amount);
  const handleAdd=()=>{
    setAttempted(true);
    const amt=numericAmount;
    if(!amt||amt<=0||!desc.trim())return toast("Enter a description and an amount above zero","error");
    dispatch({type:"ADD_EXPENSE",account,amount:amt,description:desc.trim()});
    toast(`Added ${fmt(amt)} expense from ${accountLabel(account)}`);
    onClose();
  };
  return <ModalShell onClose={onClose} label="Add expense">
    <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:14,fontFamily:FONT_DISPLAY}}>Add expense</div>
    <div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Pay from</div>
    <Segmented ariaLabel="Pay from" value={account} onChange={setAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>
    <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
      <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Tools, transport, supplies" error={attempted&&!desc.trim()?"Add a short description.":undefined}/>
      <Inp label="Amount (₱)" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" error={attempted&&(!numericAmount||numericAmount<=0)?"Enter an amount greater than ₱0.":undefined}/>
    </div>
    {numericAmount>0&&<div style={{marginTop:12,padding:"10px 12px",borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`,fontSize:12.5,color:t.textMuted}}>Money leaving {accountLabel(account)}: <strong style={{color:t.negative}}>{fmt(numericAmount)}</strong></div>}
    <div style={{marginTop:16,display:"flex",gap:8}}><Btn variant="danger" icon={Minus} onClick={handleAdd} style={{flex:1}}>Log expense</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
  </ModalShell>;
}
