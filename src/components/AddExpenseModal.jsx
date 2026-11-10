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
  const handleAdd=()=>{
    const amt=Number(amount);
    if(!amt||!desc.trim())return toast("Fill all fields","error");
    dispatch({type:"ADD_EXPENSE",account,amount:amt,description:desc.trim()});
    toast(`Added ${fmt(amt)} expense from ${accountLabel(account)}`);
    onClose();
  };
  return <ModalShell onClose={onClose} label="Add expense">
    <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:14,fontFamily:FONT_DISPLAY}}>Add expense</div>
    <div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Pay from</div>
    <Segmented ariaLabel="Pay from" value={account} onChange={setAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>
    <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
      <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Tools, transport, supplies"/>
      <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/>
    </div>
    <div style={{marginTop:16,display:"flex",gap:8}}><Btn variant="danger" icon={Minus} onClick={handleAdd} style={{flex:1}}>Log expense</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
  </ModalShell>;
}
