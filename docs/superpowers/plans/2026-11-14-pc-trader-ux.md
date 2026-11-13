# PC Trader Workflow and Screen UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve screen hierarchy and task flow across Dashboard, Buy, Sell, Inventory, and the navigation handoffs between them.

**Architecture:** Refine existing React screens with existing components and theme tokens. Keep workspace and record context in the URL and pass exact search/selection requests through the existing App props; do not introduce a router or new data model.

**Tech Stack:** React 18, Vite, inline styles, existing house components, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-11-14-pc-trader-ux-design.md`

## Global Constraints

- Preserve existing business behavior and stored data.
- Reuse existing components and theme tokens; add no dependencies.
- Do not add or run tests unless the user asks; run the production build as the compile check.
- Keep mobile and keyboard access intact.

## Review Focus

- Direct URLs with invalid workspace or missing record IDs fall back to a safe screen without crashing.
- Browser Back/Forward updates the active workspace and does not erase unsaved form state.
- Search deep links open the exact supported result even when duplicate names exist.
- Build preselection only includes parts still available; stale/invalid IDs are ignored.
- Desktop list and mobile card layouts expose the same detail actions and status information.

---

### Task 1: Dashboard hierarchy

**Files:** `src/pages/dashboard/DashboardTop.jsx`, `src/pages/dashboard/DashboardBottom.jsx`, `src/pages/dashboard/useDashboardModel.js` only if required for an existing filter jump.

- [ ] Put balances, period profit, and the most useful inventory alerts before secondary analytics.
- [ ] Remove the repeated current net-worth readout; move the calculation into a concise disclosure.
- [ ] Make stock alerts open Inventory with the relevant filter already applied.
- [ ] Preserve existing metric calculations and analytics sections.

### Task 2: Buy and Sell forms

**Files:** `src/pages/Buy.jsx`, `src/pages/Sell.jsx`.

- [ ] Group required purchase fields and item rows; visually subordinate photos and notes without removing them.
- [ ] Keep the purchase total/allocation summary close to bundle rows and the primary submit action clear.
- [ ] Add an accessible search field to the Sell item picker and filter the current part/build choices.
- [ ] Place buyer, conversation link, and proof photo in a collapsed optional-details section.
- [ ] Keep the selected item, price suggestions, payment choice, and profit preview together.

### Task 3: Inventory desktop scan view

**Files:** `src/pages/Inventory.jsx` and existing component imports only if needed.

- [ ] Use a compact row layout at desktop widths with name, status, category, cost, market value, and margin.
- [ ] Keep the current card grid at mobile widths.
- [ ] Preserve grouping, filters, sorting, detail sheets, and all current actions in both layouts.

### Task 4: Context-preserving links and navigation

**Files:** `src/App.jsx`, `src/components/ALL_TABS.jsx`, `src/components/TAB_ICON.jsx`, `src/components/GlobalSearchModal.jsx`, `src/pages/Inventory.jsx`, `src/pages/Builds.jsx`, `src/pages/history/useHistoryModel.js`, `src/pages/history/HistoryContent.jsx`, and chat navigation callers only where they depend on tab labels.

- [ ] Group desktop navigation as Overview, Stock, Sales, and Money; keep Settings under More and keep mobile primary destinations reachable.
- [ ] Label History as Activity in navigation while retaining the internal page component and existing data behavior.
- [ ] Move Cash ledger under Money and keep sales/item history under Activity.
- [ ] Add URL-backed workspace state and browser Back/Forward handling without adding a router.
- [ ] Add optional part/build/sale IDs to navigation handoff state and open the exact record from global search.
- [ ] Carry the selected available part into the Builds selection; preserve Inventory filters and scroll position on return.

### Task 5: Review and compile

**Files:** all files above.

- [ ] Review changed screens at desktop and narrow mobile sizes for clipped controls, hierarchy, and contrast in both themes.
- [ ] Confirm keyboard use for the searchable picker, disclosures, navigation, and record sheets.
- [ ] Run `npm run build`; fix compile errors without changing financial logic.
