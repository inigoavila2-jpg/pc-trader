import { useState } from "react";

import { Banknote, Plus, Wallet } from "lucide-react";
import { fmt, accountLabel } from "../data/model.js";
import { FONT_DISPLAY, useTheme } from "./theme.js";
import { usePersistentState } from "../hooks/appHooks.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Segmented } from "./Segmented.jsx";

export function AddIncomeModal({onClose,dispatch,toast}) {
  const t=useTheme();
  const [account,setAccount]=usePersistentState("pctrader:lastIncomeAccount","bank");
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const handleAdd=()=>{
    const amt=Number(amount);
    if(!amt||!desc.trim())return toast("Fill all fields","error");
    dispatch({type:"ADD_INCOME",account,amount:amt,description:desc.trim()});
    toast(`+${fmt(amt)} added to ${accountLabel(account)}`);
    onClose();
  };
  return <ModalShell onClose={onClose} label="Add income">
    <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Add income</div>
    <div style={{fontSize:12,color:t.textFaint,marginBottom:14}}>Money coming in outside of an inventory sale.</div>
    <div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Deposit into</div>
    <Segmented ariaLabel="Deposit into" value={account} onChange={setAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>
    <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
      <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Fixed a PC for a client"/>
      <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/>
    </div>
    <div style={{marginTop:16,display:"flex",gap:8}}><Btn variant="success" icon={Plus} onClick={handleAdd} style={{flex:1}}>Log income</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn></div>
  </ModalShell>;
}

