import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, TrendingUp } from "lucide-react";
import { fmt, pct } from "../data/model.js";
import { Btn, Card, NetWorthHistoryChart, PageHeader, SectionHeader, useTheme } from "../components/index.js";
import { useMediaQuery } from "../hooks/appHooks.js";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All", days: null },
];

function formatDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function chartPoints(rows) {
  if (rows.length <= 12) return rows;
  return Array.from({ length: 12 }, (_, index) => rows[Math.round(index * (rows.length - 1) / 11)]);
}

export function NetWorthHistory({ state }) {
  const t = useTheme();
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const [range, setRange] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const snapshots = useMemo(() => (Array.isArray(state?.netWorthSnapshots) ? state.netWorthSnapshots : [])
    .filter((snapshot) => snapshot?.date && Number.isFinite(Number(snapshot.netWorth)))
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date))), [state?.netWorthSnapshots]);
  const visible = useMemo(() => {
    if (range === null || snapshots.length === 0) return snapshots;
    const latest = new Date(`${snapshots[snapshots.length - 1].date}T00:00:00`);
    const cutoff = new Date(latest);
    cutoff.setDate(cutoff.getDate() - range + 1);
    return snapshots.filter((snapshot) => new Date(`${snapshot.date}T00:00:00`) >= cutoff);
  }, [range, snapshots]);
  const points = chartPoints(visible).map((snapshot) => ({
    key: snapshot.id || snapshot.date,
    label: new Date(`${snapshot.date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    date: snapshot.date,
    value: Number(snapshot.netWorth),
  }));
  const first = visible[0];
  const latest = visible[visible.length - 1];
  const selected = visible.find((snapshot) => snapshot.date === selectedDate) || latest;
  const previous = selected ? [...snapshots].reverse().find((snapshot) => snapshot.date < selected.date) : null;
  const changeRows = previous && selected ? [
    ["Business bank", Number(selected.businessCash||0)-Number(previous.businessCash||0)],
    ["Cash on hand", Number(selected.cashOnHand||0)-Number(previous.cashOnHand||0)],
    ["Inventory value", Number(selected.inventoryMarketValue||0)-Number(previous.inventoryMarketValue||0)],
    ["Receivables", Number(selected.outstandingReceivables||0)-Number(previous.outstandingReceivables||0)],
    ["Debt", Number(previous.totalDebt||0)-Number(selected.totalDebt||0)],
  ] : [];
  const isoDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const activityTypes = { PURCHASE:"Bought", SALE:"Sold", EXPENSE:"Spent", INCOME:"Received", REVERSAL:"Reversal", TRANSFER:"Transfer" };
  const activities = previous && selected ? (state?.transactions||[]).filter((transaction) => {
    const date=isoDate(transaction.date);
    return date>previous.date && date<=selected.date && activityTypes[transaction.type];
  }).sort((a,b)=>isoDate(a.date).localeCompare(isoDate(b.date))) : [];
  const change = first && latest ? Number(latest.netWorth) - Number(first.netWorth) : 0;
  const changePct = first && Number(first.netWorth) !== 0 ? change / Math.abs(Number(first.netWorth)) : null;
  const previousByDate = new Map(snapshots.map((snapshot, index) => [snapshot.date, snapshots[index - 1]]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader title="Net worth history" sub="See how your business finances change over time." />
      <Card>
        <SectionHeader icon={TrendingUp} title="Progress" sub={`${visible.length} daily snapshots in this range; the chart samples the trend and the list below shows every saved value.`} />
        <div role="group" aria-label="History date range" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {RANGES.map((option) => (
            <Btn key={option.label} small variant={range === option.days ? "primary" : "ghost"}
              aria-pressed={range === option.days} onClick={() => setRange(option.days)}>{option.label}</Btn>
          ))}
        </div>
        {visible.length > 0 ? <NetWorthHistoryChart rows={points} onSelect={(point)=>setSelectedDate(point.date)} /> : (
          <div style={{ padding: "22px 8px", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
            <CalendarDays size={20} style={{ display: "block", margin: "0 auto 8px" }} />
            No saved snapshots in this range yet. The app records a snapshot each day.
          </div>
        )}
        {selected&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <SectionHeader icon={TrendingUp} title={previous?`Why it changed since ${formatDate(previous.date)}`:"Starting snapshot"} sub={previous?`${formatDate(selected.date)} · net worth ${fmt(Number(selected.netWorth)-Number(previous.netWorth))}`:"There is no earlier saved snapshot to compare."}/>
          {previous&&<>
            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>{changeRows.map(([label,value])=><div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12.5}}><span style={{color:t.textMuted}}>{label}</span><span style={{fontFamily:"monospace",fontWeight:650,color:value>=0?t.positive:t.negative}}>{value>=0?"+":"−"}{fmt(Math.abs(value))}</span></div>)}</div>
            <div style={{fontSize:12,fontWeight:700,color:t.text,marginBottom:7}}>Recorded activity</div>
            {activities.length? <div style={{display:"flex",flexDirection:"column",gap:6}}>{activities.map((event)=><div key={event.id} style={{display:"flex",justifyContent:"space-between",gap:10,background:t.surfaceSunken,borderRadius:8,padding:"9px 10px",fontSize:12}}><span style={{color:t.text,minWidth:0}}>{activityTypes[event.type]} · {event.description||event.type}</span><span style={{fontFamily:"monospace",whiteSpace:"nowrap",color:event.type==="SALE"||event.type==="INCOME"?t.positive:event.type==="TRANSFER"?t.textMuted:t.negative}}>{event.type==="TRANSFER"?"No net-worth change":`${["SALE","INCOME"].includes(event.type)?"+":"−"}${fmt(event.amount)}`}</span></div>)}</div> : <div style={{fontSize:12,color:t.textMuted}}>No purchase, sale, income, or expense records in this interval.</div>}
            <div style={{fontSize:11,color:t.textFaint,marginTop:9}}>Activity amounts show cash movement. Inventory value can also change as items enter, leave, or are revalued; saved history may not identify the exact item for older dates.</div>
          </>}
        </div>}
        {first && latest && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12,
            marginTop: 15, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
            <Summary label="Net worth change" value={`${change >= 0 ? "+" : "−"}${fmt(Math.abs(change))}`}
              detail={changePct === null ? "Across selected dates" : `${changePct >= 0 ? "+" : "−"}${pct(Math.abs(changePct))} across selected dates`}
              color={change >= 0 ? t.positive : t.negative} />
            <Summary label="First snapshot" value={fmt(first.netWorth)} detail={formatDate(first.date)} color={t.text} />
            <Summary label="Latest snapshot" value={fmt(latest.netWorth)} detail={formatDate(latest.date)} color={t.text} />
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader icon={CalendarDays} title="Snapshot list" sub={`${visible.length} saved snapshot${visible.length === 1 ? "" : "s"}`} />
        {visible.length === 0 ? (
          <div style={{ color: t.textFaint, fontSize: 13, padding: "8px 0" }}>Your history will appear here as daily snapshots are saved.</div>
        ) : (
          isSmallScreen ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...visible].reverse().map((snapshot) => {
              const previous = previousByDate.get(snapshot.date);
              const dailyChange = previous ? Number(snapshot.netWorth) - Number(previous.netWorth) : null;
              const ChangeIcon = dailyChange !== null && dailyChange < 0 ? ArrowDownRight : ArrowUpRight;
              const tone = dailyChange === null ? t.textFaint : dailyChange >= 0 ? t.positive : t.negative;
              return <div key={snapshot.id || snapshot.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "11px 12px", borderRadius: 9, background: t.surfaceSunken, border: `1px solid ${t.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: t.text, fontSize: 12.5, fontWeight: 600 }}>{formatDate(snapshot.date)}</div>
                  <div style={{ color: tone, fontSize: 11.5, fontFamily: "monospace", marginTop: 3 }}>
                    {dailyChange === null ? "Baseline" : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><ChangeIcon size={13}/>{dailyChange >= 0 ? "+" : "−"}{fmt(Math.abs(dailyChange))}</span>}
                  </div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{fmt(snapshot.netWorth)}</div>
              </div>;
            })}
          </div> : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420, fontSize: 12.5 }}>
              <thead><tr style={{ color: t.textFaint, textAlign: "left" }}>
                <th style={cellStyle}>Date</th><th style={{ ...cellStyle, textAlign: "right" }}>Net worth</th>
                <th style={{ ...cellStyle, textAlign: "right" }}>Change from previous day</th>
              </tr></thead>
              <tbody>{[...visible].reverse().map((snapshot) => {
                const previous = previousByDate.get(snapshot.date);
                const dailyChange = previous ? Number(snapshot.netWorth) - Number(previous.netWorth) : null;
                const ChangeIcon = dailyChange !== null && dailyChange < 0 ? ArrowDownRight : ArrowUpRight;
                const tone = dailyChange === null ? t.textFaint : dailyChange >= 0 ? t.positive : t.negative;
                return <tr key={snapshot.id || snapshot.date} style={{ borderTop: `1px solid ${t.border}` }}>
                  <td style={{ ...cellStyle, color: t.text }}>{formatDate(snapshot.date)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", color: t.text, fontWeight: 700, fontFamily: "monospace" }}>{fmt(snapshot.netWorth)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", color: tone, fontFamily: "monospace" }}>
                    {dailyChange === null ? "Baseline" : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <ChangeIcon size={13} />{dailyChange >= 0 ? "+" : "−"}{fmt(Math.abs(dailyChange))}
                    </span>}
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const cellStyle = { padding: "11px 8px", whiteSpace: "nowrap" };

function Summary({ label, value, detail, color }) {
  const t = useTheme();
  return <div><div style={{ color: t.textMuted, fontSize: 11, marginBottom: 3 }}>{label}</div>
    <div style={{ color, fontFamily: "monospace", fontSize: 15, fontWeight: 700 }}>{value}</div>
    <div style={{ color: t.textFaint, fontSize: 10.5, marginTop: 3 }}>{detail}</div></div>;
}
