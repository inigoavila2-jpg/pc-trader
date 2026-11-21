# Growth-First Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Business Overview feel growth-first while keeping net-worth changes accurate and visually calm.

**Architecture:** Reorder the existing dashboard metrics and use semantic theme colors for financial values. Share one tested net-worth-below-zero predicate between the dashboard and the reusable net-worth chart so red indicates an actually negative total balance, not a downward trend.

**Tech Stack:** React 18, Vite, existing theme tokens, inline SVG, Node's built-in test runner.

**Spec:** [../specs/2026-11-21-growth-first-dashboard-design.md](../specs/2026-11-21-growth-first-dashboard-design.md)

## Global Constraints

- Keep financial calculations, snapshot values, and the schema unchanged. Only migrate the built-in Premium Light palette when its saved colors exactly match the prior stock preset; preserve custom palettes.
- In the light theme, use positive `rgb(31, 122, 77)`, inventory `rgb(37, 42, 49)`, and net worth `rgb(24, 33, 43)` through existing semantic theme tokens.
- Use slate/info for ordinary net-worth declines; red is reserved for total net worth below zero.
- Use warning/amber for negative period profit/ROI and the below-baseline warning.
- Preserve period labels, responsive behavior, and chart pointer/keyboard accessibility.
- Add no dependencies; do not commit or push unless requested.

## Review Focus

- Positive total net worth with a declining chart must remain neutral in color; check in both light and dark themes.
- A zero balance is not below zero and must not receive the red state; pin this boundary in the predicate test.
- A negative total net worth must receive the red state in the dashboard and chart.
- Negative period profit/ROI and under-baseline cash remain warnings, not red net-worth alerts.
- Other Business Overview losses and attention states use warning/amber, not red.
- Chart labels, focus, arrow-key navigation, and pointer selection must continue to work after moving the chart and its summary.

---

## Files and Responsibilities

- `src/components/netWorthTone.mjs` — shared pure predicate for whether total net worth is below zero.
- `src/components/netWorthTone.test.mjs` — boundary tests for negative, zero, positive, and invalid values.
- `src/data/model.js` — exact positive color for the built-in Premium Light palette.
- `src/data/useAppData.js` — migrate only an unmodified prior Premium Light palette.
- `src/App.jsx` — conditional tone for the shared profit summaries.
- `src/pages/dashboard/DashboardTop.jsx` — growth-first metric hierarchy and dashboard summary colors.
- `src/pages/dashboard/DashboardBottom.jsx` — warning tones for non-net-worth losses and attention states.
- `src/pages/dashboard/useDashboardModel.js` — warning tone for the non-net-worth financial-health status.
- `src/components/CapitalFlowDiagram.jsx` — warning tone for negative profit.
- `src/components/ProfitAreaChart.jsx` — warning tone for negative profit history.
- `src/components/NetWorthHistoryChart.jsx` — trend and delta colors based on current balance status, not trend direction.

### Task 1: Add a tested net-worth status predicate

**Files:**
- Create: `src/components/netWorthTone.mjs`
- Create: `src/components/netWorthTone.test.mjs`

- [x] **Step 1: Write the failing boundary test** for `isNetWorthNegative(value)`: `-1` is true; `0`, `1`, and `NaN` are false.

```js
import assert from "node:assert/strict";
import test from "node:test";
import { isNetWorthNegative } from "./netWorthTone.mjs";

test("only a below-zero net worth is negative", () => {
  assert.equal(isNetWorthNegative(-1), true);
  assert.equal(isNetWorthNegative(0), false);
  assert.equal(isNetWorthNegative(1), false);
  assert.equal(isNetWorthNegative(Number.NaN), false);
});
```

- [x] **Step 2: Run `node --test src/components/netWorthTone.test.mjs`** and confirm it fails at the negative-balance assertion before the helper behavior is implemented.
- [x] **Step 3: Implement `isNetWorthNegative(value)`** as a pure numeric `< 0` check; do not add theme or display logic to the helper.
- [x] **Step 4: Run `node --test src/components/netWorthTone.test.mjs`** and confirm all boundary cases pass.

### Task 2: Put business performance first

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/data/model.js`
- Modify: `src/data/useAppData.js`
- Modify: `src/pages/dashboard/DashboardTop.jsx`
- Modify: `src/pages/dashboard/DashboardBottom.jsx`
- Modify: `src/pages/dashboard/useDashboardModel.js`
- Modify: `src/components/CapitalFlowDiagram.jsx`
- Modify: `src/components/ProfitAreaChart.jsx`

- [x] **Step 0: Use browser fixtures to capture the failing baseline** for profit/ROI appearing before net worth, a declining positive balance using a non-red line/delta, and non-net-worth alerts/losses using `t.warning`.
- [x] **Step 1: Move the selected-period profit and ROI into the first, higher-emphasis performance panel** immediately after the header/period selector and above the net-worth hero/chart. Keep the existing period-aware labels and values.
- [x] **Step 2: Place net worth next, then keep available money and inventory visible as secondary figures.** Use `isNetWorthNegative(netWorth)` for the net-worth number and snapshot delta; keep positive/ordinary states on `t.text`/`t.textMuted`.
- [x] **Step 3: Apply semantic metric tones:** available money `t.positive`, inventory `t.accent`, positive profit/ROI `t.positive`, and negative profit/ROI or other non-net-worth losses/alerts `t.warning`, including the shared profit summaries. Do not prefix `+` to a negative highest-profit sale. Set the built-in Premium Light positive token to `#1F7A4D`; migrate only an exact prior stock palette.
- [x] **Step 4: Review the dashboard in light and dark themes** and verify All time still shows the unchanged `+₱115,269` profit and `53.4%` ROI above the net-worth trend; use a negative-sale fixture to verify loss signs and amber tones, confirm under-baseline alerts are amber, and verify exact-preset migration leaves custom palettes unchanged.

### Task 3: Make net-worth trend color reflect balance status

**Files:**
- Modify: `src/components/NetWorthHistoryChart.jsx`

- [x] **Step 1: Use the latest net-worth value with `isNetWorthNegative`** to select the chart line and trend-summary tone: `t.info` when balance is zero or positive; `t.negative` only when below zero.
- [x] **Step 2: Use muted `t.textMuted` for a negative snapshot-to-snapshot delta while the total balance is non-negative; keep the signed amount and label unchanged.**
- [x] **Step 3: Preserve the chart's SVG labels, slider semantics, and pointer/touch/keyboard selection behavior.**
- [x] **Step 4: Run `node --test src/components/netWorthTone.test.mjs` and `npm run build`.**
- [x] **Step 5: Visually verify the existing declining-but-positive history in desktop/mobile and light/dark views; confirm the line and ordinary delta are non-red, positive figures use the requested light-theme colors, and chart keyboard/pointer inspection still works.**
