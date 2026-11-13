import { useState, useMemo, useEffect, useRef } from "react";
import { today, normalizeAccount } from "../../data/model.js";
import { useTheme } from "../../components/index.js";

export function useHistoryModel(props) {
  const { state, dispatch, toast, openLightbox, jumpRequest, onRecordChange, onViewChange } = props;
  const t=useTheme();
  const [view,setView]=useState(()=>jumpRequest?.view||"transactions"); // "transactions" | "partTimeline" | "ledger"
  const [walletFilter,setWalletFilter]=useState("all");
  const [sel,setSel]=useState("");
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  useEffect(()=>{
    if(jumpRequest){
      setView(jumpRequest.view||"transactions");
      setSearch(jumpRequest.query||"");
      setTypeFilter("all");
    }
  },[jumpRequest]);
  const [plFilter,setPlFilter]=useState("all");
  const [viewingSale,setViewingSale]=useState(null);
  const lastSaleId=useRef(null);
  useEffect(()=>{
    if(jumpRequest?.saleId){const sale=state.sales.find(item=>item.id===jumpRequest.saleId);if(sale)setViewingSale(sale);}
    else if(jumpRequest)setViewingSale(null);
  },[jumpRequest,state.sales]);
  useEffect(()=>{
    if(lastSaleId.current===viewingSale?.id)return;
    lastSaleId.current=viewingSale?.id||null;
    onRecordChange?.("sale",viewingSale?.id);
  },[viewingSale?.id,onRecordChange]);
  const changeView=nextView=>{setView(nextView);onViewChange?.(nextView);};
  const [editingSale,setEditingSale]=useState(null);
  const [undoingSale,setUndoingSale]=useState(null);
  const [deletingSale,setDeletingSale]=useState(null);
  const part=state.parts.find(p=>p.id===sel);

  const allSales=state.sales;
  const activeSales=allSales.filter(s=>!s.deleted&&!s.returned&&!s.writeOff);

  const ledgerEntries=useMemo(()=>{
    const transactions=(state.transactions||[]).filter(tx=>{
      // Keep old personal entries stored, but exclude them from the new business-funds UI.
      if(tx.type==="TRANSFER" && (tx.from==="personal"||tx.to==="personal")) return false;
      if(tx.type!=="TRANSFER" && tx.wallet==="personal" && !tx.account) return false;
      return true;
    }).map(tx=>{
      const txAccount=tx.account ? normalizeAccount(tx.account) : (tx.wallet==="business"?"bank":null);
      let bankDelta=0,cashDelta=0;
      if(tx.type==="TRANSFER"){
        const from=tx.from==="business"?"bank":normalizeAccount(tx.from);
        const to=tx.to==="business"?"bank":normalizeAccount(tx.to);
        if(from==="bank")bankDelta-=Number(tx.amount||0);
        if(from==="cash")cashDelta-=Number(tx.amount||0);
        if(to==="bank")bankDelta+=Number(tx.amount||0);
        if(to==="cash")cashDelta+=Number(tx.amount||0);
      } else {
        const amount=Number(tx.amount||0);
        const delta=(tx.type==="SALE"||tx.type==="INCOME")?amount:-amount;
        if(txAccount==="bank")bankDelta=delta;
        if(txAccount==="cash")cashDelta=delta;
      }
      return {...tx,_txAccount:txAccount,_bankDelta:bankDelta,_cashDelta:cashDelta};
    }).filter(tx=>walletFilter==="all" ? true : walletFilter==="bank" ? tx._bankDelta!==0 : tx._cashDelta!==0);

    // Reconstruct each account independently from the live balances, then attach accurate
    // before/after values to every event. Filters are applied after these balances are derived.
    const chronological=[...transactions].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)||String(a.id).localeCompare(String(b.id)));
    let bankRunning=Number(state.businessCash||0),cashRunning=Number(state.cashOnHand||0);
    const balances=new Map();
    [...chronological].reverse().forEach(tx=>{
      const bankAfter=bankRunning,cashAfter=cashRunning;
      const bankBefore=bankAfter-tx._bankDelta,cashBefore=cashAfter-tx._cashDelta;
      bankRunning=bankBefore;cashRunning=cashBefore;
      balances.set(String(tx.id),{_bankBefore:bankBefore,_bankAfter:bankAfter,_cashBefore:cashBefore,_cashAfter:cashAfter});
    });
    return chronological.map(tx=>({...tx,...(balances.get(String(tx.id))||{})}));
  },[state.transactions,state.businessCash,state.cashOnHand,walletFilter]);

  const [ledgerSort,setLedgerSort]=useState("newest");
  const [ledgerFlow,setLedgerFlow]=useState("all");
  const [ledgerRange,setLedgerRange]=useState("all");

  const filteredLedgerEntries=useMemo(()=>{
    const now=new Date();
    const startOfToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    const startOfMonth=new Date(now.getFullYear(),now.getMonth(),1).getTime();
    const thirtyDaysAgo=new Date(now.getTime()-30*24*60*60*1000).getTime();

    const filtered=ledgerEntries.filter(tx=>{
      const deltaForView=walletFilter==="bank"?tx._bankDelta:walletFilter==="cash"?tx._cashDelta:(tx._bankDelta+tx._cashDelta);
      if(ledgerFlow==="spending" && !(tx.type==="PURCHASE"||tx.type==="EXPENSE"||tx.type==="REVERSAL")) return false;
      if(ledgerFlow==="income" && !(tx.type==="INCOME"||tx.type==="SALE")) return false;
      if(ledgerFlow==="transfers" && tx.type!=="TRANSFER") return false;
      if((ledgerFlow==="spending"||ledgerFlow==="income")&&deltaForView===0)return false;
      if(ledgerRange!=="all") {
        const ms=new Date(tx.date||0).getTime();
        if(Number.isNaN(ms)) return false;
        if(ledgerRange==="today" && ms<startOfToday) return false;
        if(ledgerRange==="month" && ms<startOfMonth) return false;
        if(ledgerRange==="30days" && ms<thirtyDaysAgo) return false;
      }
      return true;
    });

    return ledgerSort==="oldest"?filtered:filtered.reverse();
  },[ledgerEntries,ledgerFlow,ledgerRange,ledgerSort]);

  const filtered=allSales.filter(s=>{
    if(s.writeOff)return false;
    if(typeFilter==="returned"&&!s.returned)return false;
    if(typeFilter==="deleted"&&!s.deleted)return false;
    if(typeFilter==="part"&&(s.deleted||s.returned||s.buildId))return false;
    if(typeFilter==="build"&&(s.deleted||s.returned||!s.buildId))return false;
    if(typeFilter==="all"&&(s.deleted||s.returned))return false;
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

  const undoSale=(reason,buildDisposition)=>{
    dispatch({type:"UNDO_SALE",saleId:undoingSale.id,reason,buildDisposition});
    toast(buildDisposition==="reactivate"
      ? `"${undoingSale.name}" sale undone — build reactivated`
      : `"${undoingSale.name}" sale undone — returned to inventory`,"warn");
    setUndoingSale(null);setViewingSale(null);
  };

  const saveEdit=(changes)=>{
    dispatch({type:"EDIT_SALE",saleId:editingSale.id,changes});
    toast("Transaction updated");
    setEditingSale(null);
  };

  const deleteRecordOnly=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"record-only"});
    toast("Transaction record deleted","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const deleteAndReturnDisassemble=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"undo-and-return",buildDisposition:"disassemble"});
    toast("Transaction deleted — item returned to inventory","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const deleteAndReactivateBuild=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"undo-and-return",buildDisposition:"reactivate"});
    toast("Transaction deleted — build reactivated and sellable again","warn");
    setDeletingSale(null);setViewingSale(null);
  };

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


  return { jumpRequest, openLightbox, toast, dispatch, state, view, setView:changeView, walletFilter, setWalletFilter, sel, setSel, search, setSearch, typeFilter, setTypeFilter, dateFrom, setDateFrom, dateTo, setDateTo, plFilter, setPlFilter, viewingSale, setViewingSale, editingSale, setEditingSale, undoingSale, setUndoingSale, deletingSale, setDeletingSale, ledgerSort, setLedgerSort, ledgerFlow, setLedgerFlow, ledgerRange, setLedgerRange, t, part, allSales, activeSales, ledgerEntries, filteredLedgerEntries, filtered, totalRevenue, totalProfitAll, totalLosses, partsSoldCount, buildsSoldCount, avgProfit, catTotals, bestCategory, bestItem, undoSale, saveEdit, deleteRecordOnly, deleteAndReturnDisassemble, deleteAndReactivateBuild, exportCSV, statusOf };
}
