

import { Wrench, Banknote, History as HistoryIcon, Search, Plus, Minus, ArrowLeftRight, Wallet, User, ClipboardList, StickyNote, Monitor, FileDown, ArrowDownUp, CalendarDays, SlidersHorizontal } from "lucide-react";
import { fmt, accountLabel } from "../../data/model.js";
import { FONT_DISPLAY, FONT_BODY, FONT_MONO, StatusBadge, PhotoThumb, ConfirmModal, Card, Btn, Inp, Sel, StatBox, PageHeader, Segmented, STATUS_COLOR_KEY, TransactionDetailSheet, EditSaleModal, ReturnReasonModal } from "../../components/index.js";

export function HistoryContent({model}) {
  const { jumpRequest, openLightbox, toast, dispatch, state, view, setView, walletFilter, setWalletFilter, sel, setSel, search, setSearch, typeFilter, setTypeFilter, dateFrom, setDateFrom, dateTo, setDateTo, plFilter, setPlFilter, viewingSale, setViewingSale, editingSale, setEditingSale, undoingSale, setUndoingSale, deletingSale, setDeletingSale, ledgerSort, setLedgerSort, ledgerFlow, setLedgerFlow, ledgerRange, setLedgerRange, t, part, allSales, activeSales, ledgerEntries, filteredLedgerEntries, filtered, totalRevenue, totalProfitAll, totalLosses, partsSoldCount, buildsSoldCount, avgProfit, catTotals, bestCategory, bestItem, undoSale, saveEdit, deleteRecordOnly, deleteAndReturnDisassemble, deleteAndReactivateBuild, exportCSV, statusOf } = model;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {viewingSale&&(
        <TransactionDetailSheet sale={viewingSale} state={state} openLightbox={openLightbox} onClose={()=>setViewingSale(null)}
          onEdit={()=>{setEditingSale(viewingSale);setViewingSale(null);}}
          onUndo={()=>{setUndoingSale(viewingSale);setViewingSale(null);}}
          onDelete={()=>{setDeletingSale(viewingSale);setViewingSale(null);}}/>
      )}
      {editingSale&&<EditSaleModal sale={editingSale} onClose={()=>setEditingSale(null)} onSave={saveEdit}/>}
      {undoingSale&&<ReturnReasonModal title="Undo this sale?" sale={undoingSale} onConfirm={undoSale} onCancel={()=>setUndoingSale(null)}/>}
      {deletingSale&&(
        <ConfirmModal title="Delete this transaction?" message={deletingSale.buildId
            ? `"${deletingSale.name}" was sold as a build. What should happen to it?`
            : `What should happen to "${deletingSale.name}"?`}
          onCancel={()=>setDeletingSale(null)}
          extraChoices={deletingSale.buildId?[
            {label:"Delete record only (item stays sold)",onClick:deleteRecordOnly,variant:"warn"},
            {label:"Delete & put build back in Builds",onClick:deleteAndReactivateBuild,variant:"success"},
            {label:"Delete & disassemble into inventory",onClick:deleteAndReturnDisassemble,variant:"success"},
          ]:[
            {label:"Delete record only (item stays sold)",onClick:deleteRecordOnly,variant:"warn"},
            {label:"Delete & return item to inventory",onClick:deleteAndReturnDisassemble,variant:"success"},
          ]}/>
      )}

      <PageHeader title="History" sub="Transactions, sales analytics, and part movement."
        action={<Btn variant="ghost" icon={FileDown} onClick={exportCSV} disabled={state.parts.length===0}>CSV</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
          <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Business Bank</div>
          <div style={{fontSize:18,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(state.businessCash||0)}</div>
          <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>actual business bank balance</div>
        </div>
        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
          <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Cash</div>
          <div style={{fontSize:18,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(state.cashOnHand||0)}</div>
          <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>physical cash on hand</div>
        </div>
      </div>

      <Segmented ariaLabel="History view" value={view} onChange={setView} options={[
        ["transactions","Sales history",ClipboardList],["partTimeline","Part timeline",HistoryIcon],["ledger","Cash ledger",Banknote],
      ]}/>

      {view==="partTimeline"?(
        <>
          <Sel label="Select part" value={sel} onChange={e=>setSel(e.target.value)}>
            <option value="">— choose a part —</option>
            {state.parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
          </Sel>
          {part&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:10}}>
                <div style={{display:"flex",gap:11,minWidth:0}}>
                  {part.photoUrl&&<PhotoThumb url={part.photoUrl} size={56} seed={part.id.length} onClick={()=>openLightbox(part.photoUrl)} label={`View photo of ${part.name}`}/>}
                  <div>
                    <div style={{color:t.text,fontWeight:700,fontSize:15,fontFamily:FONT_DISPLAY}}>{part.name}</div>
                    <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{part.category} · {part.source}</div>
                    {part.notes&&<div style={{color:t.textMuted,fontSize:11.5,marginTop:4,display:"flex",alignItems:"center",gap:5}}><StickyNote size={11}/>{part.notes}</div>}
                    {part.soldTo&&<div style={{color:t.textFaint,fontSize:11,marginTop:2}}>Sold to: {part.soldTo}</div>}
                  </div>
                </div>
                <StatusBadge s={part.status}/>
              </div>
              <div style={{position:"relative",paddingLeft:16}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:1,background:t.border}}/>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {part.history.map((h,i)=>(
                    <div key={i} style={{position:"relative",animation:`blFadeUp 0.2s ease ${i*0.04}s both`}}>
                      <div style={{position:"absolute",left:-20,top:4,width:7,height:7,borderRadius:"50%",background:t.accent}}/>
                      <div style={{fontSize:10.5,color:t.textFaint}}>{h.date}</div>
                      <div style={{fontSize:13,color:t.text,marginTop:2}}>{h.event}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {state.parts.length===0&&(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No parts yet.</div></Card>
          )}
        </>
      ):view==="ledger"?(
        <>
          <Segmented ariaLabel="Account" value={walletFilter} onChange={setWalletFilter} options={[["all","All accounts",ArrowLeftRight],["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:10.5,color:t.textFaint,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><ArrowDownUp size={11}/> Sort</div>
                <Segmented ariaLabel="Ledger sort" value={ledgerSort} onChange={setLedgerSort} options={[["newest","Latest first",ArrowDownUp],["oldest","Oldest first",HistoryIcon]]}/>
              </div>
              <div>
                <div style={{fontSize:10.5,color:t.textFaint,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><CalendarDays size={11}/> Date</div>
                <Segmented ariaLabel="Ledger date range" value={ledgerRange} onChange={setLedgerRange} options={[["all","All",CalendarDays],["month","This month",CalendarDays],["30days","30 days",CalendarDays]]}/>
              </div>
            </div>

            <div>
              <div style={{fontSize:10.5,color:t.textFaint,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><SlidersHorizontal size={11}/> Flow</div>
              <Segmented ariaLabel="Ledger flow" value={ledgerFlow} onChange={setLedgerFlow} options={[
                ["all","All",Banknote],["spending","Spending",Minus],["income","Income",Plus],["transfers","Transfers",ArrowLeftRight],
              ]}/>
            </div>
          </div>

          <div style={{fontSize:10.5,color:t.textFaint,marginTop:2}}>Showing {filteredLedgerEntries.length} {filteredLedgerEntries.length===1?"entry":"entries"} · newest entries appear first by default</div>

          {filteredLedgerEntries.length===0?(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No {walletFilter=== "all" ? "business funds" : accountLabel(walletFilter)} activity matches these filters.</div></Card>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredLedgerEntries.map((tx,i)=>(
                <div key={tx.id} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:"13px 14px",
                  animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:tx._delta>0?t.positive:t.negative,flexShrink:0}}/>
                        <div style={{color:t.text,fontSize:13,fontWeight:650,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description}</div>
                      </div>
                      <div style={{color:t.textFaint,fontSize:10.5,marginTop:3}}>{tx.date}{tx.type?` · ${tx.type}`:""}</div>
                    </div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,fontSize:13,color:(walletFilter==="bank"?tx._bankDelta:walletFilter==="cash"?tx._cashDelta:tx._bankDelta+tx._cashDelta)>=0?t.positive:t.negative,whiteSpace:"nowrap",textAlign:"right"}}>
                      {tx.type==="TRANSFER"&&walletFilter==="all" ? <span style={{fontSize:10.5,display:"block",lineHeight:1.6}}>Bank {tx._bankDelta<0?"−":"+"}{fmt(Math.abs(tx._bankDelta))}<br/>Cash {tx._cashDelta<0?"−":"+"}{fmt(Math.abs(tx._cashDelta))}</span> : <>{(walletFilter==="bank"?tx._bankDelta:walletFilter==="cash"?tx._cashDelta:tx._bankDelta+tx._cashDelta)>=0?"+":"−"}{fmt(Math.abs(walletFilter==="bank"?tx._bankDelta:walletFilter==="cash"?tx._cashDelta:tx._bankDelta+tx._cashDelta))}</>}
                    </div>
                  </div>

                  {tx.type==="TRANSFER"&&walletFilter==="all" ? (
                    <div style={{marginTop:11,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,paddingTop:10,borderTop:`1px solid ${t.border}`}}>
                      {[["Business Bank",tx._bankBefore,tx._bankAfter],["Cash",tx._cashBefore,tx._cashAfter]].map(([label,before,after])=>(
                        <div key={label} style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:8,padding:9}}>
                          <div style={{fontSize:9.5,color:t.textFaint,fontWeight:700}}>{label}</div>
                          <div style={{fontSize:9.5,color:t.textFaint,marginTop:5}}>Before</div><div style={{fontFamily:FONT_MONO,fontSize:11.5,color:t.text}}>{fmt(before)}</div>
                          <div style={{fontSize:9.5,color:t.textFaint,marginTop:4}}>After</div><div style={{fontFamily:FONT_MONO,fontSize:11.5,fontWeight:700,color:t.text}}>{fmt(after)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (()=>{
                    const isBank=walletFilter==="bank"||(walletFilter==="all"&&tx._bankDelta!==0);
                    const before=isBank?tx._bankBefore:tx._cashBefore;
                    const after=isBank?tx._bankAfter:tx._cashAfter;
                    const label=isBank?"Business Bank":"Cash";
                    return <div style={{marginTop:11,display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",paddingTop:10,borderTop:`1px solid ${t.border}`}}>
                      <div><div style={{fontSize:9.5,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700}}>{label} before</div><div style={{fontFamily:FONT_MONO,fontSize:12.5,color:t.text,marginTop:3}}>{fmt(before)}</div></div>
                      <div style={{color:t.textFaint,fontSize:14}}>→</div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:9.5,color:t.textFaint,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700}}>{label} after</div><div style={{fontFamily:FONT_MONO,fontSize:12.5,fontWeight:700,color:t.text,marginTop:3}}>{fmt(after)}</div></div>
                    </div>;
                  })()}
                </div>
              ))}
            </div>
          )}
        </>
      ):(
        <>
          {activeSales.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
              <StatBox label="Total revenue" value={fmt(totalRevenue)} color={t.positive}/>
              <StatBox label="Total profit" value={fmt(totalProfitAll)} color={totalProfitAll>=0?t.positive:t.negative}/>
              <StatBox label="Total losses" value={fmt(-totalLosses)} color={t.negative}/>
              <StatBox label="Avg. profit / sale" value={fmt(avgProfit)}/>
              <StatBox label="Parts sold" value={String(partsSoldCount)}/>
              <StatBox label="Builds sold" value={String(buildsSoldCount)}/>
              {bestCategory&&<StatBox label="Best category" value={bestCategory[0]} sub={`+${fmt(bestCategory[1])} profit`} color={t.info}/>}
              {bestItem&&<StatBox label="Most profitable sale" value={bestItem.name} sub={`+${fmt(bestItem.profit)}`} color={t.info}/>}
            </div>
          )}

          <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item or buyer name…" icon={Search} aria-label="Search transactions"/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All"],["part","Parts only"],["build","Builds only"],["returned","Returned"],["deleted","Deleted"]].map(([v,l])=>(
              <Btn key={v} small variant={typeFilter===v?"primary":"ghost"} onClick={()=>setTypeFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All P/L"],["profit","Profit only"],["loss","Loss only"]].map(([v,l])=>(
              <Btn key={v} small variant={plFilter===v?"primary":"ghost"} onClick={()=>setPlFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="From date" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
            <Inp label="To date" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>

          {filtered.length===0?(
            <Card style={{textAlign:"center",padding:36}}>
              <ClipboardList size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
              <div style={{color:t.text,fontWeight:600}}>No transactions match these filters.</div>
              <div style={{color:t.textMuted,fontSize:12.5,marginTop:5}}>Try another search or clear the filters to see all activity.</div>
              <Btn small variant="ghost" onClick={()=>{setSearch("");setTypeFilter("all");setPlFilter("all");setDateFrom("");setDateTo("");}}>Clear filters</Btn>
            </Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
              {[...filtered].reverse().map((s,i)=>{
                const linkedPart=state.parts.find(p=>p.id===s.partId);
                const linkedBuild=state.builds.find(b=>b.id===s.buildId);
                const img=s.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
                const status=statusOf(s);
                const statusColor=t[STATUS_COLOR_KEY[status]]||t.textMuted;
                const ariaLabel=`${s.name}, ${status}, sold ${fmt(s.salePrice)}, ${s.profit>=0?"profit":"loss"} ${fmt(Math.abs(s.profit))}`;
                return (
                  <button key={s.id} onClick={()=>setViewingSale(s)} aria-label={ariaLabel} className="bl-focusable" style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:13,
                    padding:10,cursor:"pointer",animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`,transition:"border-color 0.15s",
                    opacity:status==="deleted"?0.55:1,textAlign:"left",fontFamily:FONT_BODY,display:"block"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.borderStrong}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                    <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:t.surfaceSunken,marginBottom:8,
                      display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`}}>
                      {img?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:(s.buildId?<Monitor size={22} strokeWidth={1.5} color={t.textFaint}/>:<Wrench size={22} strokeWidth={1.5} color={t.textFaint}/>)}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:4}}>
                      <span style={{fontSize:9.5,fontWeight:700,color:statusColor,letterSpacing:"0.03em"}}>{status}</span>
                      <span style={{color:t.textFaint,fontSize:9}}>{s.buildId?"BUILD":"PART"}</span>
                    </div>
                    <div style={{color:t.text,fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                      display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.name}</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}>{fmt(s.salePrice)}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.textFaint,marginTop:2}}>
                      <span>{s.date}</span>
                      <span style={{color:s.profit>=0?t.positive:t.negative,fontWeight:600}}>{s.profit>=0?"+":""}{fmt(s.profit)}</span>
                    </div>
                    {s.buyerName&&<div style={{color:t.textFaint,fontSize:10,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}><User size={10}/>{s.buyerName}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
