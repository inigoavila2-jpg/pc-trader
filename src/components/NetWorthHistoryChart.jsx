import { useId, useState } from "react";
import { fmt } from "../data/model.js";
import { FONT_MONO, useTheme } from "./theme.js";

function fullDate(row) {
  if (!row.date) return row.label;
  const date = new Date(`${row.date}T00:00:00`);
  return Number.isNaN(date.getTime()) ? row.date : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function NetWorthHistoryChart({ rows }) {
  const t = useTheme();
  const chartId = `nwh-${t.mode}-${useId().replace(/:/g, "")}`;
  const [hoverIndex, setHoverIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);
  if (!rows?.length) return null;
  const values = rows.map((row) => Number(row.value || 0));
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max - min);
  const toXY = (value, index) => [index / Math.max(1, rows.length - 1) * 100, 33 - ((value - min) / span) * 27];
  const path = rows.map((row, index) => {
    const [x, y] = toXY(row.value, index);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const trend = values[values.length - 1] - values[0];
  const color = trend >= 0 ? t.positive : t.negative;
  const activeIndex = hoverIndex ?? pinnedIndex ?? rows.length - 1;
  const [activeX, activeY] = toXY(values[activeIndex], activeIndex);
  const labels = [...new Map([rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].map((row) => [row.key, row])).values()];

  const selectFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const index = Math.round(ratio * (rows.length - 1));
    setHoverIndex(index);
    return index;
  };
  const handleKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
      : Math.min(rows.length - 1, Math.max(0, activeIndex + (event.key === "ArrowRight" ? 1 : -1)));
    setPinnedIndex(next);
    setHoverIndex(null);
  };

  return (
    <div>
      <div style={{ minHeight: 42, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "8px 10px", marginBottom: 4, borderRadius: 9, background: t.surfaceSunken, border: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 12, color: t.textMuted }}>{fullDate(rows[activeIndex])}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: t.text }}>{fmt(values[activeIndex])}</span>
      </div>
      <svg viewBox="0 0 100 42" style={{ width: "100%", height: 132, display: "block", touchAction: "pan-y" }} preserveAspectRatio="none"
        role="slider" aria-label="Net worth history. Use left and right arrow keys to inspect values."
        aria-valuemin={0} aria-valuemax={rows.length - 1} aria-valuenow={activeIndex}
        aria-valuetext={`${fullDate(rows[activeIndex])}: ${fmt(values[activeIndex])}`} tabIndex={0}
        onPointerMove={selectFromPointer} onPointerLeave={() => setHoverIndex(null)}
        onPointerDown={(event) => { if (event.pointerType === "touch") setPinnedIndex(selectFromPointer(event)); }}
        onClick={(event) => setPinnedIndex(selectFromPointer(event))} onKeyDown={handleKeyDown}>
        <defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.24"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        {[7, 14, 21, 28, 35].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={t.border} strokeWidth="0.4"/>)}
        <path d={`M0,33 ${path.replace(/^M/, "L")} L100,33 Z`} fill={`url(#${chartId})`} stroke="none"/>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        <line x1={activeX} y1="4" x2={activeX} y2="35" stroke={color} strokeWidth="0.7" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke"/>
        {rows.map((row, index) => {
          const [x, y] = toXY(row.value, index);
          return <circle key={row.key} cx={x} cy={y} r={index === activeIndex ? 2.3 : 1.25} fill={color} stroke={index === activeIndex ? t.bgElevated : "none"} strokeWidth="1" vectorEffect="non-scaling-stroke"/>;
        })}
        <circle cx={activeX} cy={activeY} r="4" fill="transparent"/>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        {labels.map((row) => <div key={row.key} style={{ fontSize: 10.5, color: t.textFaint, textAlign: "center", whiteSpace: "nowrap" }}>{row.label}</div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 11, color: t.textFaint }}>First → latest saved value</span>
        <span style={{ fontSize: 12, fontFamily: FONT_MONO, fontWeight: 700, color }}>{trend >= 0 ? "+" : "−"}{fmt(Math.abs(trend))}</span>
      </div>
    </div>
  );
}
