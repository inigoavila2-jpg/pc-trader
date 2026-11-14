import { useState } from "react";
import { fmt, pct, localISODate } from "../../data/model.js";
import { useTheme } from "../../components/index.js";

export function useDashboardModel(props) {
  const { state, dispatch, toast, setTab, openLightbox } = props;
  const t=useTheme();
  const [addingExpense,setAddingExpense]=useState(()=>new URLSearchParams(window.location.search).get("quick")==="expense");
  const [addingIncome,setAddingIncome]=useState(false);
  const [transferring,setTransferring]=useState(false);
  const [period,setPeriod]=useState("all"); // "month" | "quarter" | "all" — governs flow metrics only
  const [sortKey,setSortKey]=useState("date");
  const [sortDir,setSortDir]=useState("desc");
  const {parts,bundles,builds}=state;

  // Deleted sale records are kept (soft-delete, for History's filter) but must never count
  // toward live figures. Returned sales are excluded too — the money didn't stay made.
  const allSales=state.sales.filter(s=>!s.deleted&&!s.returned);

  const parseDate=(str)=>{ if(!str)return null; const d=new Date(str); return isNaN(d.getTime())?null:d; };
  const now=new Date();
  const inPeriod=(dateStr)=>{
    if(period==="all")return true;
    const d=parseDate(dateStr);
    if(!d)return true; // never silently hide a record just because its date didn't parse
    if(period==="month")return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    if(period==="quarter")return d.getFullYear()===now.getFullYear()&&Math.floor(d.getMonth()/3)===Math.floor(now.getMonth()/3);
    return true;
  };
  const sales=allSales.filter(s=>inPeriod(s.date)); // period-scoped — used for all flow metrics below

  // ── SNAPSHOT METRICS (always "as of now") ──────────────────────────────────────
  const activeInventory=parts.filter(p=>p.status==="available"||p.status==="in_build");
  const inventoryMarketValue=activeInventory.reduce((s,p)=>{const mkt=p.marketValue||0;return s+(mkt>0?mkt:p.allocatedCost);},0);
  const inventoryCost=activeInventory.reduce((s,p)=>s+p.allocatedCost,0);
  const businessBank=Number(state.businessCash||0);
  const cashOnHand=Number(state.cashOnHand||0);
  const totalLiquid=businessBank+cashOnHand;
  const outstandingReceivables=Number(state.outstandingReceivables||0);
  const totalDebt=Number(state.totalDebt||0);
  const netWorth=totalLiquid+inventoryMarketValue+outstandingReceivables-totalDebt;
  const netWorthSnapshots=Array.isArray(state.netWorthSnapshots)?state.netWorthSnapshots:[];

  // Last six calendar months, using the latest saved snapshot available in each month.
  const sixMonthNetWorthRows=Array.from({length:6},(_,idx)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-(5-idx),1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const monthSnaps=netWorthSnapshots
      .filter(s=>String(s.date||"").slice(0,7)===key)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const latest=monthSnaps[monthSnaps.length-1];
    return {
      key,
      label:d.toLocaleDateString("en-PH",{month:"short",year:"numeric"}),
      value:latest?Number(latest.netWorth||0):null,
      date:latest?.date||null,
    };
  }).filter(r=>r.value!==null);
  const previousNetWorth=netWorthSnapshots
    .filter(s=>s.date!==localISODate())
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]?.netWorth;
  const netWorthDailyChange=previousNetWorth!==undefined?netWorth-Number(previousNetWorth):null;
  const fundsToRecover=(state.expenses||[]).filter(e=>e.type==="personal_draw").reduce((s,e)=>s+e.amount,0);
  const isUnderCapital=totalLiquid<14500;
  const available=parts.filter(p=>p.status==="available").length;
  const inBuild=parts.filter(p=>p.status==="in_build").length;
  const soldCount=parts.filter(p=>p.status==="sold").length;
  const totalCapitalAllTime=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const atRisk=parts.filter(p=>p.status!=="sold"&&p.status!=="defective").reduce((s,p)=>s+p.allocatedCost,0);
  const recoveredCostAllTime=parts.filter(p=>p.status==="sold").reduce((s,p)=>s+p.allocatedCost,0);
  const writeOffLoss=allSales.filter(s=>s.writeOff).reduce((s,x)=>s+Math.abs(x.profit),0);
  const writeOffCount=parts.filter(p=>p.status==="defective").length;

  const DEAD_DAYS=30;
  const deadInventory=parts.filter(p=>{
    if(p.status!=="available")return false;
    const bought=parseDate(p.history?.[0]?.date);
    if(!bought)return false;
    return Math.round((now-bought)/86400000)>DEAD_DAYS;
  });
  const deadInventoryValue=deadInventory.reduce((s,p)=>s+(p.marketValue||p.allocatedCost),0);

  // ── FLOW METRICS (respect the period switch) ───────────────────────────────────
  const invested=parts.filter(p=>{const d=parseDate(p.history?.[0]?.date);return d?inPeriod(p.history[0].date):period==="all";}).reduce((s,p)=>s+p.allocatedCost,0);
  const recovered=sales.reduce((s,x)=>s+x.salePrice,0);
  const periodCOGS=sales.reduce((s,x)=>s+x.cost,0);
  const totalProfit=recovered-periodCOGS;
  const roi=periodCOGS>0?totalProfit/periodCOGS:0;
  const inventoryTurnoverRate=inventoryCost>0?periodCOGS/inventoryCost:0;
  const avgProfitPerSale=sales.length?totalProfit/sales.length:0;
  const highestProfitSale=sales.length?[...sales].sort((a,b)=>b.profit-a.profit)[0]:null;

  // ── OPERATIONAL: avg days to sell (all-time — needs the full sample to be stable) ──
  const holdDurations=[];
  parts.filter(p=>p.status==="sold").forEach(p=>{
    const sale=allSales.find(s=>s.partId===p.id)||allSales.find(s=>s.name===p.name);
    const bought=p.history?.[0]?.date;
    if(sale&&bought){
      const d1=parseDate(bought),d2=parseDate(sale.date);
      if(d1&&d2)holdDurations.push(Math.max(0,Math.round((d2-d1)/86400000)));
    }
  });
  const avgDaysToSell=holdDurations.length?Math.round(holdDurations.reduce((s,d)=>s+d,0)/holdDurations.length):null;

  // ── MONTH-OVER-MONTH (always all-time source data — "Best Month Ever" can't be period-scoped) ──
  const monthMap={};
  allSales.forEach(s=>{
    const d=parseDate(s.date); if(!d)return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!monthMap[key])monthMap[key]={label:d.toLocaleDateString("en-PH",{month:"short",year:"numeric"}),profit:0,sortKey:key};
    monthMap[key].profit+=s.profit;
  });
  const monthRows=Object.values(monthMap).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
  const thisMonthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthKey=`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;
  const thisMonthProfit=monthMap[thisMonthKey]?.profit||0;
  const lastMonthProfit=monthMap[lastMonthKey]?.profit||0;
  const momGrowthPct=lastMonthProfit!==0?(thisMonthProfit-lastMonthProfit)/Math.abs(lastMonthProfit):(thisMonthProfit>0?1:0);
  const bestMonth=monthRows.length?monthRows.reduce((a,b)=>b.profit>a.profit?b:a):null;

  // ── Profit trend chart data (period-scoped, running cumulative across the period's sales) ──
  let running=0;
  const cumPoints=sales.map(s=>{running+=s.profit;return running;});

  // ── Profit by category (period-scoped) ──
  const categoryProfit={};
  sales.forEach(s=>{
    const part=parts.find(p=>p.name===s.name);
    const cat=part?.category||"Other";
    if(!categoryProfit[cat])categoryProfit[cat]={profit:0,count:0};
    categoryProfit[cat].profit+=s.profit;
    categoryProfit[cat].count+=1;
  });
  const categoryRows=Object.entries(categoryProfit).sort((a,b)=>b[1].profit-a[1].profit);
  const maxCatProfit=Math.max(1,...categoryRows.map(([,v])=>Math.abs(v.profit)));

  // ── CFO Insights — every line is derived from a real number above, never invented ──
  const insights=[];
  if(categoryRows.length>0){
    const [topCat,topVal]=categoryRows[0];
    const posTotal=categoryRows.reduce((s,[,v])=>s+Math.max(v.profit,0),0)||1;
    const share=Math.round(Math.max(topVal.profit,0)/posTotal*100);
    if(topVal.profit>0)insights.push(`${topCat} generates ${share}% of total profit — your strongest category.`);
  }
  if(avgDaysToSell!==null)insights.push(`Average sale completes in ${avgDaysToSell} day${avgDaysToSell===1?"":"s"} from purchase to sale.`);
  if(parts.length>0){
    const avgCost=totalCapitalAllTime/parts.length;
    if(avgCost>0&&totalLiquid>0){
      const buyingPower=Math.floor(totalLiquid/avgCost);
      if(buyingPower>0)insights.push(`Current cash position supports ${buyingPower} more purchase${buyingPower===1?"":"s"} at your average part cost of ${fmt(Math.round(avgCost))}.`);
    }
  }
  if(lastMonthProfit!==0)insights.push(`Profit ${momGrowthPct>=0?"increased":"decreased"} ${pct(Math.abs(momGrowthPct))} vs. last month.`);
  if(deadInventory.length>0)insights.push(`${deadInventory.length} item${deadInventory.length===1?"":"s"} worth ${fmt(deadInventoryValue)} has sat unsold for over ${DEAD_DAYS} days.`);
  if(insights.length===0)insights.push("Record a few sales to unlock CFO-level insights on category performance, cash runway, and momentum.");

  // ── Financial Health Score (0–100), weighted composite ──
  const roiScore=Math.max(0,Math.min(roi/0.5,1));
  const turnoverScore=Math.max(0,Math.min(inventoryTurnoverRate/2,1));
  const cashScore=Math.max(0,Math.min(totalLiquid/14500,1));
  const growthScore=Math.max(0,Math.min((momGrowthPct+0.5)/1,1));
  const healthScore=Math.round(roiScore*25+turnoverScore*25+cashScore*25+growthScore*25);
  const healthTier=healthScore>=90?{label:"Excellent",color:t.positive}
    :healthScore>=70?{label:"Good",color:t.warning}
    :{label:"Needs attention",color:t.negative};

  // ── Recent transactions table (period-scoped, sortable) ──
  const getDaysHeld=(sale)=>{
    let boughtStr=null;
    if(sale.partId){
      boughtStr=parts.find(p=>p.id===sale.partId)?.history?.[0]?.date;
    } else if(sale.buildId){
      const build=builds.find(b=>b.id===sale.buildId);
      const buildParts=build?parts.filter(p=>build.partIds.includes(p.id)):[];
      const dates=buildParts.map(p=>parseDate(p.history?.[0]?.date)).filter(Boolean);
      if(dates.length)boughtStr=new Date(Math.min(...dates)).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
    }
    if(!boughtStr)boughtStr=parts.find(p=>p.name===sale.name)?.history?.[0]?.date;
    const d1=parseDate(boughtStr),d2=parseDate(sale.date);
    return d1&&d2?Math.max(0,Math.round((d2-d1)/86400000)):null;
  };
  const txRows=sales.map(s=>({
    id:s.id,name:s.name,cost:s.cost,salePrice:s.salePrice,profit:s.profit,
    roi:s.cost>0?s.profit/s.cost:0,days:getDaysHeld(s),date:s.date,
  }));
  const sortedTx=[...txRows].sort((a,b)=>{
    let av=a[sortKey],bv=b[sortKey];
    if(sortKey==="name"){av=av||"";bv=bv||"";return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);}
    if(sortKey==="date"){av=parseDate(av)?.getTime()||0;bv=parseDate(bv)?.getTime()||0;}
    else{av=av??-Infinity;bv=bv??-Infinity;}
    return sortDir==="asc"?av-bv:bv-av;
  }).slice(0,12);
  const toggleSort=(key)=>{
    if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortKey(key);setSortDir("desc");}
  };

  const periodLabel=period==="month"?"this month":period==="quarter"?"this quarter":"all time";


  return { openLightbox, setTab, toast, dispatch, state, addingExpense, setAddingExpense, addingIncome, setAddingIncome, transferring, setTransferring, period, setPeriod, sortKey, setSortKey, sortDir, setSortDir, parts, bundles, builds, t, allSales, parseDate, now, inPeriod, sales, activeInventory, inventoryMarketValue, inventoryCost, businessBank, cashOnHand, totalLiquid, outstandingReceivables, totalDebt, netWorth, netWorthSnapshots, sixMonthNetWorthRows, previousNetWorth, netWorthDailyChange, fundsToRecover, isUnderCapital, available, inBuild, soldCount, totalCapitalAllTime, atRisk, recoveredCostAllTime, writeOffLoss, writeOffCount, DEAD_DAYS, deadInventory, deadInventoryValue, invested, recovered, periodCOGS, totalProfit, roi, inventoryTurnoverRate, avgProfitPerSale, highestProfitSale, holdDurations, avgDaysToSell, monthMap, monthRows, thisMonthKey, lastMonthDate, lastMonthKey, thisMonthProfit, lastMonthProfit, momGrowthPct, bestMonth, running, cumPoints, categoryProfit, categoryRows, maxCatProfit, insights, roiScore, turnoverScore, cashScore, growthScore, healthScore, healthTier, getDaysHeld, txRows, sortedTx, toggleSort, periodLabel };
}
