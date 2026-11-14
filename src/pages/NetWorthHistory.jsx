import { useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Sparkles, TrendingUp } from "lucide-react";
import { fmt, pct } from "../data/model.js";
import { Btn, Card, NetWorthHistoryChart, PageHeader, SectionHeader, useTheme } from "../components/index.js";
import { getGeminiVisionClient } from "../components/mediaUtils.js";
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

function activityDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function intervalActivities(state, previousDate, selectedDate, labels) {
  const transactions = Array.isArray(state?.transactions) ? state.transactions : [];
  const parts = Array.isArray(state?.parts) ? state.parts : [];
  const sales = Array.isArray(state?.sales) ? state.sales : [];
  const builds = Array.isArray(state?.builds) ? state.builds : [];
  const saleItems = (sale) => {
    if (!sale) return [];
    if (Array.isArray(sale.buildPartsSnapshot) && sale.buildPartsSnapshot.length) return sale.buildPartsSnapshot.map((part) => part.name).filter(Boolean);
    if (sale.partId) return parts.filter((part) => part.id === sale.partId).map((part) => part.name).filter(Boolean);
    const build = builds.find((row) => row.id === sale.buildId);
    return parts.filter((part) => build?.partIds?.includes(part.id)).map((part) => part.name).filter(Boolean);
  };
  const isInRange = (date) => date > previousDate && date <= selectedDate;
  const ledger = transactions.filter((row) => isInRange(activityDate(row.date)) && labels[String(row.type).toUpperCase()])
    .map((row) => {
      const type = String(row.type).toUpperCase();
      const date = activityDate(row.date);
      const sale = type === "SALE" ? sales.find((item) => activityDate(item.date) === date
        && Number(item.salePrice) === Number(row.amount)
        && String(row.description || "").includes(String(item.name || ""))) : null;
      const bundle = type === "PURCHASE" ? (Array.isArray(state?.bundles) ? state.bundles : []).find((item) =>
        activityDate(item.date) === date && Number(item.purchasePrice) === Number(row.amount)
        && String(row.description || "").includes(String(item.name || ""))) : null;
      const itemNames = type === "SALE" ? saleItems(sale) : type === "PURCHASE" && bundle
        ? parts.filter((part) => part.bundleId === bundle.id).map((part) => part.name).filter(Boolean)
        : type === "PURCHASE" ? parts.filter((part) => activityDate(part.history?.[0]?.date) === date
          && String(row.description || "").toLowerCase().includes(String(part.name || "").toLowerCase())).map((part) => part.name).filter(Boolean)
          : [];
      return { ...row, type, date, description: String(row.description || "").replace(/^(Bought|Sold|Spent|Received)\s+/i, ""), itemNames };
    });
  const hasLedgerEntry = (type, date) => ledger.some((row) => row.type === type && row.date === date);
  const legacy = [];
  for (const sale of sales) {
    const date = activityDate(sale.date);
    if (isInRange(date) && !hasLedgerEntry("SALE", date) && Number(sale.salePrice) > 0) {
      legacy.push({ id: sale.id, type: "SALE", amount: sale.salePrice, description: sale.name || "item", date, itemNames: saleItems(sale) });
    }
  }
  for (const expense of Array.isArray(state?.expenses) ? state.expenses : []) {
    const date = activityDate(expense.date);
    if (isInRange(date) && !hasLedgerEntry("EXPENSE", date) && Number(expense.amount) > 0) {
      legacy.push({ id: expense.id, type: "EXPENSE", amount: expense.amount, description: expense.description || "Expense", date });
    }
  }
  for (const part of parts) {
    for (const entry of Array.isArray(part.history) ? part.history : []) {
      const date = activityDate(entry.date);
      const event = String(entry.event || "");
      const amount = Number((event.match(/₱\s*([\d,]+(?:\.\d+)?)/) || [])[1]?.replace(/,/g, ""));
      if (/\bBought\b/i.test(event) && isInRange(date) && !hasLedgerEntry("PURCHASE", date) && amount > 0) {
        legacy.push({ id: `${part.id}-${date}-${event}`, type: "PURCHASE", amount, description: part.name || "item", date, itemNames: [part.name].filter(Boolean) });
      }
    }
  }
  return [...ledger, ...legacy].sort((a, b) => a.date.localeCompare(b.date));
}

export function NetWorthHistory({ state }) {
  const t = useTheme();
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const [range, setRange] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiCache = useRef(new Map());
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
  const activityTypes = { PURCHASE:"Bought", SALE:"Sold", EXPENSE:"Spent", INCOME:"Received", REVERSAL:"Reversal", TRANSFER:"Transfer" };
  const activities = previous && selected ? intervalActivities(state, previous.date, selected.date, activityTypes) : [];
  const explainChange = async () => {
    if (!previous || !selected) return;
    setAiLoading(true);
    setAiError("");
    try {
      const ai = await getGeminiVisionClient();
      if (!ai) throw new Error("Gemini is not configured.");
      const facts = {
        interval: `${previous.date} to ${selected.date}`,
        netWorthChange: Number(selected.netWorth) - Number(previous.netWorth),
        componentChanges: changeRows.map(([name, amount]) => ({ name, amount })),
        recordedActivity: activities.map(({ type, date, description, amount, itemNames }) => ({ type, date, description, amount: Number(amount), exactItems: itemNames })),
      };
      const cacheKey = JSON.stringify(facts);
      if (aiCache.current.has(cacheKey)) {
        setAiExplanation({ date: selected.date, text: aiCache.current.get(cacheKey) });
        return;
      }
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Explain this net-worth change in 2 short sentences using only these facts. Name the exact items listed in exactItems and describe the recorded actions. If exactItems is empty, say the item was not identified. Never infer a cause that is not explicitly supported; if activity is missing, say the records do not show why. Do not calculate or change the supplied amounts.\n${JSON.stringify(facts)}`,
        config: { temperature: 0.2 },
      });
      const text = String(result?.text || "").trim();
      if (!text) throw new Error("Gemini returned an empty explanation.");
      aiCache.current.set(cacheKey, text);
      setAiExplanation({ date: selected.date, text });
    } catch (error) {
      setAiError(error?.message || "Could not generate an explanation. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };
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
            {activities.length? <div style={{display:"flex",flexDirection:"column",gap:6}}>{activities.map((event)=><div key={event.id} style={{display:"flex",justifyContent:"space-between",gap:10,background:t.surfaceSunken,borderRadius:8,padding:"9px 10px",fontSize:12}}><span style={{color:t.text,minWidth:0}}><span>{activityTypes[event.type]} · {event.description||event.type}</span>{event.itemNames?.length>0&&<span style={{display:"block",marginTop:3,color:t.textMuted,fontSize:11}}>Items: {event.itemNames.join(", ")}</span>}</span><span style={{fontFamily:"monospace",whiteSpace:"nowrap",color:event.type==="SALE"||event.type==="INCOME"?t.positive:event.type==="TRANSFER"?t.textMuted:t.negative}}>{event.type==="TRANSFER"?"No net-worth change":`${["SALE","INCOME"].includes(event.type)?"+":"−"}${fmt(event.amount)}`}</span></div>)}</div> : <div style={{fontSize:12,color:t.textMuted}}>No purchase, sale, income, or expense records in this interval.</div>}
            <div style={{marginTop:10}}><Btn small variant="ghost" icon={Sparkles} loading={aiLoading} onClick={explainChange}>Explain this change</Btn></div>
            {aiExplanation?.date===selected.date&&<div role="status" aria-live="polite" style={{marginTop:9,padding:10,borderRadius:8,background:t.surfaceSunken,color:t.text,fontSize:12,lineHeight:1.5}}><strong style={{display:"block",marginBottom:4}}>AI explanation</strong>{aiExplanation.text}</div>}
            {aiError&&<div role="alert" style={{marginTop:7,color:t.negative,fontSize:12}}>{aiError}</div>}
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
