

import { Boxes, X, AlertTriangle, TrendingUp, ArrowRight, ClipboardList, StickyNote, Monitor, PackageCheck, Tag, Sparkles } from "lucide-react";
import { fmt, pct, today } from "../../data/model.js";
import { FONT_DISPLAY, FONT_MONO, Card, Btn, IconBtn, SectionHeader, ProfitAreaChart, HealthScoreRing, SortHeader } from "../../components/index.js";

export function DashboardBottom({model}) {
  const { openLightbox, setTab, toast, dispatch, state, addingExpense, setAddingExpense, addingIncome, setAddingIncome, transferring, setTransferring, period, setPeriod, sortKey, setSortKey, sortDir, setSortDir, parts, bundles, builds, t, allSales, parseDate, now, inPeriod, sales, activeInventory, inventoryMarketValue, inventoryCost, businessBank, cashOnHand, totalLiquid, outstandingReceivables, totalDebt, netWorth, netWorthSnapshots, sixMonthNetWorthRows, previousNetWorth, netWorthDailyChange, fundsToRecover, isUnderCapital, available, inBuild, soldCount, totalCapitalAllTime, atRisk, recoveredCostAllTime, writeOffLoss, writeOffCount, DEAD_DAYS, deadInventory, deadInventoryValue, invested, recovered, periodCOGS, totalProfit, roi, inventoryTurnoverRate, avgProfitPerSale, highestProfitSale, holdDurations, avgDaysToSell, monthMap, monthRows, thisMonthKey, lastMonthDate, lastMonthKey, thisMonthProfit, lastMonthProfit, momGrowthPct, bestMonth, running, cumPoints, categoryProfit, categoryRows, maxCatProfit, insights, roiScore, turnoverScore, cashScore, growthScore, healthScore, healthTier, getDaysHeld, txRows, sortedTx, toggleSort, periodLabel } = model;
  return (<>
      {/* ── Group: Inventory & performance ── */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:14}}>
        <Card>
          <SectionHeader icon={Boxes} title="Inventory intelligence" sub="How efficiently stock is moving, as of today"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14}}>
            {[
              ["Available",available,t.positive,"ready to sell or build"],
              ["In builds",inBuild,t.info,"allocated to active builds"],
              ["Sold",soldCount,t.textMuted,"lifetime units moved"],
              ["Avg. days to sell",avgDaysToSell!==null?`${avgDaysToSell}d`:"—",t.accent,"purchase to sale, all-time"],
              ["Turnover rate",`${inventoryTurnoverRate.toFixed(2)}×`,t.info,`cost of goods sold ÷ current stock cost, ${periodLabel}`],
              ["Cash conversion",avgDaysToSell!==null?`~${avgDaysToSell}d`:"—",t.accent,"≈ days to sell — cash purchases, cash sales"],
            ].map(([l,v,c,sub])=>(
              <div key={l}>
                <div style={{fontSize:19,fontWeight:700,fontFamily:FONT_MONO,color:c}}>{v}</div>
                <div style={{fontSize:11,color:t.text,fontWeight:600,marginTop:4}}>{l}</div>
                <div style={{fontSize:10,color:t.textFaint,marginTop:2,lineHeight:1.35}}>{sub}</div>
              </div>
            ))}
          </div>
          {deadInventory.length>0&&(
            <div style={{background:t.warningSoft,border:`1px solid ${t.warningSoftBorder}`,borderRadius:9,padding:"11px 12px",marginTop:16}}>
              <div style={{color:t.warning,fontWeight:700,fontSize:12.5,marginBottom:3,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={13}/>Dead inventory — {deadInventory.length} item{deadInventory.length===1?"":"s"} unsold {DEAD_DAYS}+ days</div>
              <div style={{color:t.textMuted,fontSize:12}}>{fmt(deadInventoryValue)} in market value sitting idle. Consider a price cut or bundling to move it.</div>
            </div>
          )}
          {writeOffCount>0&&(
            <div style={{fontSize:11.5,color:t.textFaint,marginTop:14,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
              {writeOffCount} write-off{writeOffCount===1?"":"s"} recorded · <span style={{color:t.negative,fontFamily:FONT_MONO}}>{fmt(-writeOffLoss)}</span> lifetime loss
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader icon={TrendingUp} title="Profit analytics"
            sub={`Running profit across ${sales.length} sale${sales.length===1?"":"s"} in the selected period`}
            action={<div style={{fontSize:12,color:totalProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO,fontWeight:600}}>{totalProfit>=0?"+":""}{fmt(totalProfit)}</div>}/>
          {cumPoints.length>1
            ? <ProfitAreaChart points={cumPoints} positive={totalProfit>=0}/>
            : <div style={{fontSize:12.5,color:t.textFaint,padding:"20px 0",textAlign:"center"}}>Need at least 2 sales in this period to plot a trend.</div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:14,marginTop:20,paddingTop:16,borderTop:`1px solid ${t.border}`}}>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Monthly profit</div>
              <div style={{fontSize:16,fontWeight:700,color:thisMonthProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{thisMonthProfit>=0?"+":""}{fmt(thisMonthProfit)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>current calendar month, always</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Best month ever</div>
              <div style={{fontSize:16,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{bestMonth?fmt(bestMonth.profit):"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>{bestMonth?bestMonth.label:"not enough data yet"}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Avg. profit / sale</div>
              <div style={{fontSize:16,fontWeight:700,color:avgProfitPerSale>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{sales.length?`${avgProfitPerSale>=0?"+":""}${fmt(Math.round(avgProfitPerSale))}`:"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>{periodLabel}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Highest profit sale</div>
              <div style={{fontSize:16,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{highestProfitSale?`+${fmt(highestProfitSale.profit)}`:"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{highestProfitSale?highestProfitSale.name:periodLabel}</div>
            </div>
          </div>
        </Card>

        {categoryRows.length>0&&(
          <Card>
            <SectionHeader icon={Tag} title="Profit by category" sub={`Which categories are actually worth buying, ${periodLabel}`}/>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {categoryRows.map(([cat,v])=>{
                const w=Math.abs(v.profit)/maxCatProfit*100;
                const positive=v.profit>=0;
                return (
                  <div key={cat}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12.5,color:t.text}}>{cat} <span style={{color:t.textFaint}}>({v.count} sold)</span></span>
                      <span style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:positive?t.positive:t.negative}}>{positive?"+":""}{fmt(v.profit)}</span>
                    </div>
                    <div style={{height:5,background:t.surfaceSunken,borderRadius:99}}>
                      <div style={{height:"100%",width:`${w}%`,background:positive?t.positive:t.negative,borderRadius:99,transition:"width 0.7s cubic-bezier(0.34,1.2,0.64,1)"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <SectionHeader icon={Sparkles} title="Financial health score"/>
          <HealthScoreRing score={healthScore} tier={healthTier}/>
        </Card>
      </div>

      {/* ── Group: Insights & activity ── */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:14}}>
        <Card style={{background:t.mode==="dark"?`linear-gradient(155deg,${t.accentSoft} 0%,${t.surface} 60%)`:`linear-gradient(155deg,${t.accentSoft} 0%,${t.surface} 60%)`,border:`1px solid ${t.accentSoftBorder}`}}>
          <SectionHeader icon={Sparkles} title="CFO insights"/>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {insights.slice(0,5).map((line,i)=>(
              <div key={i} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                <ArrowRight size={13} color={t.accent} style={{flexShrink:0,marginTop:3}}/>
                <span style={{fontSize:13,color:t.text,lineHeight:1.55}}>{line}</span>
              </div>
            ))}
          </div>
        </Card>

        {sortedTx.length>0&&(
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"16px 18px 6px"}}>
              <SectionHeader icon={ClipboardList} title="Recent transactions" sub={`${periodLabel} · tap a column to sort`}/>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:520}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${t.border}`}}>
                    <SortHeader label="Product" active={sortKey==="name"} dir={sortDir} onClick={()=>toggleSort("name")}/>
                    <SortHeader label="Buy" active={sortKey==="cost"} dir={sortDir} onClick={()=>toggleSort("cost")} align="right"/>
                    <SortHeader label="Sale" active={sortKey==="salePrice"} dir={sortDir} onClick={()=>toggleSort("salePrice")} align="right"/>
                    <SortHeader label="Profit" active={sortKey==="profit"} dir={sortDir} onClick={()=>toggleSort("profit")} align="right"/>
                    <SortHeader label="ROI" active={sortKey==="roi"} dir={sortDir} onClick={()=>toggleSort("roi")} align="right"/>
                    <SortHeader label="Held" active={sortKey==="days"} dir={sortDir} onClick={()=>toggleSort("days")} align="right"/>
                  </tr>
                </thead>
                <tbody>
                  {sortedTx.map(r=>(
                    <tr key={r.id} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:"10px",color:t.text,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.textMuted,fontFamily:FONT_MONO}}>{fmt(r.cost)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.text,fontFamily:FONT_MONO}}>{fmt(r.salePrice)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:r.profit>=0?t.positive:t.negative,fontFamily:FONT_MONO,fontWeight:700}}>{r.profit>=0?"+":""}{fmt(r.profit)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:r.roi>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{pct(r.roi)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.textFaint,fontFamily:FONT_MONO}}>{r.days!==null?`${r.days}d`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {bundles.length>0&&(()=>{
          const bundlePnl=bundles.map(b=>{
            const bParts=parts.filter(p=>p.bundleId===b.id);
            const soldParts=bParts.filter(p=>p.status==="sold");
            const unsoldParts=bParts.filter(p=>p.status!=="sold");
            const recoveredAmt=soldParts.reduce((s,p)=>{
              const sale=allSales.find(s=>s.partId===p.id)||allSales.find(s=>s.name===p.name);
              return s+(sale?sale.salePrice:0);
            },0);
            const unsoldMarket=unsoldParts.reduce((s,p)=>s+p.marketValue,0);
            return {...b,bParts,soldParts,unsoldParts,recoveredAmt,unsoldMarket};
          });
          return (
            <Card>
              <SectionHeader icon={PackageCheck} title="Bundle recovery"/>
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                {bundlePnl.map(b=>{
                  const recPct=b.purchasePrice>0?Math.min(b.recoveredAmt/b.purchasePrice*100,100):0;
                  return (
                    <div key={b.id}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,color:t.text,fontWeight:500}}>{b.name}</span>
                        <span style={{fontSize:12,color:t.textFaint,fontFamily:FONT_MONO}}>{fmt(b.recoveredAmt)} / {fmt(b.purchasePrice)}</span>
                      </div>
                      <div style={{height:5,background:t.surfaceSunken,borderRadius:99}}>
                        <div style={{height:"100%",width:`${recPct}%`,background:recPct>=100?t.positive:t.accent,borderRadius:99,transition:"width 0.8s ease"}}/>
                      </div>
                      <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>
                        {b.soldParts.length}/{b.bParts.length} parts sold · {b.unsoldParts.length} remaining ~{fmt(b.unsoldMarket)} market
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {(state.quickNotes||[]).length>0&&(
          <Card>
            <SectionHeader icon={StickyNote} title="Quick notes"/>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...state.quickNotes].reverse().map(n=>(
                <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,
                  background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:t.text,fontSize:13,lineHeight:1.45,whiteSpace:"pre-wrap"}}>{n.text}</div>
                    <div style={{color:t.textFaint,fontSize:10.5,marginTop:5}}>{n.date}</div>
                  </div>
                  <IconBtn icon={X} label="Delete note" size={30} iconSize={14} onClick={()=>dispatch({type:"DELETE_QUICK_NOTE",id:n.id})}/>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {parts.length===0&&(
        <Card style={{textAlign:"center",padding:48}}>
          <Monitor size={40} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:14}}/>
          <div style={{color:t.text,fontWeight:600,fontFamily:FONT_DISPLAY}}>No parts yet</div>
          <div style={{color:t.textFaint,fontSize:13,marginTop:6}}>Go to Buy → add your first bundle.</div>
          <div style={{marginTop:18}}><Btn onClick={()=>setTab("Buy")}>Start buying</Btn></div>
        </Card>
      )}  </>);
}
