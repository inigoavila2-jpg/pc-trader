import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, TrendingUp } from "lucide-react";
import { fmt, pct } from "../data/model.js";
import { Btn, Card, NetWorthHistoryChart, PageHeader, SectionHeader, useTheme } from "../components/index.js";

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
  const [range, setRange] = useState(30);
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
    value: Number(snapshot.netWorth),
  }));
  const first = visible[0];
  const latest = visible[visible.length - 1];
  const change = first && latest ? Number(latest.netWorth) - Number(first.netWorth) : 0;
  const changePct = first && Number(first.netWorth) !== 0 ? change / Math.abs(Number(first.netWorth)) : null;
  const previousByDate = new Map(snapshots.map((snapshot, index) => [snapshot.date, snapshots[index - 1]]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader title="Net worth history" sub="See how your business finances change over time." />
      <Card>
        <SectionHeader icon={TrendingUp} title="Progress" sub={`${visible.length} daily snapshots shown; the date range is anchored to the latest saved snapshot. The table below lists every saved value in that range.`} />
        <div role="group" aria-label="History date range" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {RANGES.map((option) => (
            <Btn key={option.label} small variant={range === option.days ? "primary" : "ghost"}
              aria-pressed={range === option.days} onClick={() => setRange(option.days)}>{option.label}</Btn>
          ))}
        </div>
        {visible.length > 0 ? <NetWorthHistoryChart rows={points} /> : (
          <div style={{ padding: "22px 8px", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
            <CalendarDays size={20} style={{ display: "block", margin: "0 auto 8px" }} />
            No saved snapshots in this range yet. The app records a snapshot each day.
          </div>
        )}
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
          <div style={{ overflowX: "auto" }}>
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
