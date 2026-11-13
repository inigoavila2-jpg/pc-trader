# PC Trader Workflow and Screen UX

## Intent

Make Dashboard, Buy, Sell, and Inventory easier to scan and faster to use, especially on phones. Keep the existing React app, custom components, business rules, and stored data.

## Goals

- Put key balances and actionable stock alerts ahead of secondary dashboard analytics, and remove repeated net-worth information.
- Make Buy forms easier to scan by grouping required purchase and item details and visually reducing optional fields.
- Make Sell item selection searchable and keep its primary fields and profit preview together.
- Provide a compact desktop inventory list while retaining the photo card grid on small screens.
- Organize navigation into Overview, Stock, Sales, and Money work areas, with Settings under More.
- Preserve context when opening a record from search or carrying a part from Inventory into Builds; make those destinations addressable by URL and browser Back/Forward.
- Keep all existing actions, keyboard access, saved records, and light/dark themes working.

## Non-goals

- No database or financial calculation changes.
- No new dependencies, Tailwind migration, or replacement of existing components.
- No new product features beyond the listed screen, navigation, and context improvements.

## Constraints

- Reuse `Card`, `Btn`, `Inp`, theme tokens, and the existing Lucide icons.
- Do not alter persisted inventory, sale, or account data.
- Keep mobile primary actions reachable and forms usable with touch and keyboard.
- Current tests are absent; do not add or run tests unless requested. Use the production build as a compile check.

## Approaches

1. **Recommended: refine existing screens and navigation.** Preserve current page boundaries and components; add only the search/context state needed for direct handoffs. Lowest behavior and maintenance risk.
2. Replace the navigation and page styling with a new component framework. Rejected because it adds dependencies and rewrites working UI without being needed for these improvements.
3. Add new workflow dashboards and separate pages for each action. Rejected because it expands the app and duplicates existing Buy, Sell, History, and Inventory functions.

## Design decisions

- Keep the existing visual style and use spacing, type hierarchy, compact desktop rows, and progressive disclosure to improve scanability.
- Keep the photo-card Inventory presentation for mobile; use rows for desktop operations.
- Treat History as Activity in navigation. Keep sales and item timelines under Activity and expose the cash ledger and net worth under Money.
- Use URL query state for the selected workspace and supported record deep links; keep it small and avoid adding a router.
- Maintain one primary action per form and keep optional fields available behind a disclosure.

## Acceptance

- Dashboard first view prioritizes balances, period results, and actionable inventory alerts without repeating the same net-worth figure.
- Buy and Sell forms have clear required/optional grouping and preserve existing submit behavior.
- Sell supports keyboard-accessible filtering of the selectable inventory and builds.
- Desktop Inventory is scannable in rows; mobile retains cards and working detail actions.
- Search can open the exact result; Add to build carries the chosen part into the build form.
- Workspace and record URLs survive refresh and browser Back/Forward without changing saved data.
- Production build succeeds; visual review covers desktop and narrow mobile layouts.
