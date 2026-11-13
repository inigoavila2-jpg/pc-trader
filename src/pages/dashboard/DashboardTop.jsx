

import { Boxes, Banknote, Plus, Minus, AlertTriangle, ArrowLeftRight, TrendingUp, PackageCheck } from "lucide-react";
import { fmt, pct } from "../../data/model.js";
import { FONT_MONO, AnimNum, Card, Btn, SectionHeader, PageHeader, HeroNumber, PeriodSwitch, KPICard, CapitalFlowDiagram, NetWorthHistoryChart } from "../../components/index.js";

export function DashboardTop({model}) {
  const { openLightbox, setTab, jumpTo, toast, dispatch, state, addingExpense, setAddingExpense, addingIncome, setAddingIncome, transferring, setTransferring, period, setPeriod, sortKey, setSortKey, sortDir, setSortDir, parts, bundles, builds, t, allSales, parseDate, now, inPeriod, sales, activeInventory, inventoryMarketValue, inventoryCost, businessBank, cashOnHand, totalLiquid, outstandingReceivables, totalDebt, netWorth, netWorthSnapshots, sixMonthNetWorthRows, previousNetWorth, netWorthDailyChange, fundsToRecover, isUnderCapital, available, inBuild, soldCount, totalCapitalAllTime, atRisk, recoveredCostAllTime, writeOffLoss, writeOffCount, DEAD_DAYS, deadInventory, deadInventoryValue, invested, recovered, periodCOGS, totalProfit, roi, inventoryTurnoverRate, avgProfitPerSale, highestProfitSale, holdDurations, avgDaysToSell, monthMap, monthRows, thisMonthKey, lastMonthDate, lastMonthKey, thisMonthProfit, lastMonthProfit, momGrowthPct, bestMonth, running, cumPoints, categoryProfit, categoryRows, maxCatProfit, insights, roiScore, turnoverScore, cashScore, growthScore, healthScore, healthTier, getDaysHeld, txRows, sortedTx, toggleSort, periodLabel } = model;
  const agingIds=deadInventory.map(part=>part.id);
  const unpricedIds=activeInventory.filter(part=>!(Number(part.marketValue)>0)).map(part=>part.id);
  const attentionIds=agingIds.length?agingIds:unpricedIds;
  const attentionTitle=agingIds.length?"Review aging inventory":"Add missing market values";
  return (<>
      {/* Header */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <PageHeader title="Business overview" sub={`Flow figures shown for ${periodLabel} · balances as of today`}
          action={
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn small variant="ghost" icon={ArrowLeftRight} onClick={()=>setTransferring(true)}>Transfer</Btn>
              <Btn small variant="ghost" icon={Plus} onClick={()=>setAddingIncome(true)}>Income</Btn>
              <Btn small variant="ghost" icon={Minus} onClick={()=>setAddingExpense(true)}>Expense</Btn>
            </div>
          }/>
        <PeriodSwitch period={period} setPeriod={setPeriod}/>
      </div>

      {attentionIds.length>0&&(
        <Card style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,borderColor:t.warningSoftBorder,background:t.warningSoft}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:10,minWidth:0}}>
            <PackageCheck size={18} color={t.warning} style={{flexShrink:0,marginTop:2}}/>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:t.text}}>{attentionTitle}</div>
              <div style={{fontSize:12.5,color:t.textMuted,marginTop:3}}>{attentionIds.length} item{attentionIds.length===1?"":"s"} need attention</div>
            </div>
          </div>
          <Btn small variant="ghost" onClick={()=>jumpTo?.("Inventory",{partIds:attentionIds})}>Review</Btn>
        </Card>
      )}

      {/* Net Worth Hero */}
      <div style={{background:t.mode==="dark"?`linear-gradient(155deg,${t.surface} 0%,${t.surfaceSunken} 100%)`:`linear-gradient(155deg,${t.surface} 0%,${t.bg} 100%)`,
        border:`1px solid ${t.border}`,borderRadius:16,padding:"24px 24px"}}>
        <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:9}}>Total business net worth</div>
        <div style={{fontSize:40,lineHeight:1}}><HeroNumber><AnimNum value={netWorth}/></HeroNumber></div>
        <details style={{marginTop:10,color:t.textMuted,fontSize:12.5,lineHeight:1.5}}>
          <summary style={{cursor:"pointer",width:"fit-content"}}>How this is calculated</summary>
          <div style={{marginTop:6}}>Business Bank + Cash + unsold inventory at market value (or cost if unknown) + receivables − debt.</div>
        </details>
        {netWorthDailyChange!==null&&(
          <div style={{fontSize:11.5,color:netWorthDailyChange>=0?t.positive:t.negative,marginTop:8,fontFamily:FONT_MONO,fontWeight:600}}>
            {netWorthDailyChange>=0?"▲":"▼"} {fmt(Math.abs(netWorthDailyChange))} vs. previous saved snapshot
          </div>
        )}
      </div>

      {/* First-scan summary: current balances plus selected-period results. */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
        <KPICard label="Available money" value={fmt(totalLiquid)} color={isUnderCapital?t.negative:t.positive} accent={isUnderCapital?t.negativeSoftBorder:undefined}
          question="Business bank balance plus physical cash, as of today"/>
        <KPICard label="Unsold inventory" value={fmt(inventoryMarketValue)} color={t.accent}
          question="Available and in-build stock at market value (fallback: cost)"/>
        <KPICard label={`${periodLabel} profit`} value={`${totalProfit>=0?"+":""}${fmt(totalProfit)}`} color={totalProfit>=0?t.positive:t.negative}
          question="Sale proceeds minus cost of goods sold in the selected period"/>
        <KPICard label={`${periodLabel} ROI`} value={pct(roi)} color={roi>=0?t.positive:t.negative}
          question="Selected-period profit divided by cost of goods sold"/>
      </div>

      {/* Detailed history follows the at-a-glance business summary. */}
      <Card>
        <SectionHeader icon={TrendingUp} title="Net worth history" sub="Saved financial snapshots — latest value captured for each calendar month" action={
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{netWorthSnapshots.length} snapshot{netWorthSnapshots.length===1?"":"s"}</div>
            <Btn small variant="ghost" icon={TrendingUp} onClick={()=>setTab("Net Worth")}>View all</Btn>
          </div>
        }/>
        {sixMonthNetWorthRows.length>=2
          ? <NetWorthHistoryChart rows={sixMonthNetWorthRows}/>
          : <div style={{padding:"18px 0 6px",textAlign:"center",fontSize:12.5,color:t.textFaint}}>
              Your financial history starts with today’s baseline. Keep using the app and this chart will build automatically day by day.
            </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:14,marginTop:16,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Saved snapshots</div><div style={{fontSize:15,fontWeight:700,fontFamily:FONT_MONO,color:t.info}}>{netWorthSnapshots.length}</div></div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Latest snapshot</div><div style={{fontSize:15,fontWeight:700,fontFamily:FONT_MONO,color:t.text}}>{netWorthSnapshots.length?netWorthSnapshots[netWorthSnapshots.length-1].date:"—"}</div></div>
        </div>
      </Card>

      {/* ── Group: Capital & cash ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:14,marginTop:10}}>
        <Card>
          <SectionHeader icon={Boxes} title="Business capital overview" sub="Where all-time capital actually sits right now"/>
          {(()=>{
            const maxVal=Math.max(totalCapitalAllTime,atRisk,recoveredCostAllTime,1);
            const barH=v=>Math.max(4,Math.round((v/maxVal)*120));
            const bars=[
              {label:"Deployed",sub:"ever spent buying",value:totalCapitalAllTime,color:t.info},
              {label:"Locked",sub:"sitting unsold",value:atRisk,color:t.warning},
              {label:"Recovered",sub:"cost basis of sold items",value:recoveredCostAllTime,color:t.positive},
            ];
            const lockedRatio=totalCapitalAllTime>0?atRisk/totalCapitalAllTime:0;
            return (
              <>
                <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-end",height:150,marginBottom:8}}>
                  {bars.map(b=>(
                    <div key={b.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"30%"}}>
                      <div style={{fontSize:12,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(b.value)}</div>
                      <div style={{width:"100%",maxWidth:64,height:barH(b.value),background:b.color,borderRadius:"6px 6px 2px 2px",
                        transition:"height 0.6s cubic-bezier(0.34,1.2,0.64,1)"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-around",marginBottom:lockedRatio>0.5?12:0}}>
                  {bars.map(b=>(
                    <div key={b.label} style={{width:"30%",textAlign:"center"}}>
                      <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600}}>{b.label}</div>
                      <div style={{fontSize:10,color:t.textFaint}}>{b.sub}</div>
                    </div>
                  ))}
                </div>
                {lockedRatio>0.5&&(
                  <div style={{background:t.warningSoft,border:`1px solid ${t.warningSoftBorder}`,borderRadius:9,padding:"10px 12px",fontSize:12,color:t.warning,display:"flex",gap:8,alignItems:"flex-start"}}>
                    <AlertTriangle size={14} style={{flexShrink:0,marginTop:1}}/>
                    <span>{pct(lockedRatio)} of everything ever spent is still sitting unsold — consider moving inventory to free up cash.</span>
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        <Card>
          <SectionHeader icon={Banknote} title="Cash flow" sub={`Capital cycle, ${periodLabel}`}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12,marginBottom:18}}>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Money invested</div><div style={{fontSize:15,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(invested)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Money recovered</div><div style={{fontSize:15,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(recovered)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Net profit</div><div style={{fontSize:15,fontWeight:700,color:totalProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{totalProfit>=0?"+":""}{fmt(totalProfit)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Total liquid</div><div style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:FONT_MONO}}>{fmt(totalLiquid)}</div></div>
          </div>
          <CapitalFlowDiagram invested={invested} inventoryVal={inventoryMarketValue} recovered={recovered} profit={totalProfit}/>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:18,paddingTop:16,borderTop:`1px solid ${t.border}`}}>
            <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:12}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Business Bank</div>
              <div style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:FONT_MONO}}>{fmt(businessBank)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>actual bank balance</div>
            </div>
            <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:12}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Cash</div>
              <div style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:FONT_MONO}}>{fmt(cashOnHand)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>physical cash on hand</div>
            </div>
          </div>

          {isUnderCapital&&(
            <div style={{background:t.negativeSoft,border:`1px solid ${t.negativeSoftBorder}`,borderRadius:9,padding:12,marginTop:14}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                <AlertTriangle size={16} color={t.negative} style={{flexShrink:0,marginTop:1}}/>
                <div style={{color:t.textMuted,fontSize:12.5,lineHeight:1.5}}>
                  <strong style={{color:t.negative}}>Below target baseline.</strong> Total liquid ({fmt(totalLiquid)}) is under the ₱14,500 war chest. Consider pausing purchases or raising prices until it recovers.
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

  </>);
}
