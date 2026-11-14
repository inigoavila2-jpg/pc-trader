# Net Worth Change Explanations Plan

**Goal:** Explain selected snapshot movements with recorded business activity and an exact saved-component comparison.

**Architecture:** Keep snapshots as the source of exact balance changes. In `NetWorthHistory`, compare a selected point to the immediately preceding saved snapshot, show the per-component bridge, and list recorded transactions between those dates. Do not attribute inventory valuation movement to a specific item when historical item values are unavailable.

**Tech Stack:** Existing React components, snapshot fields, transaction records, and theme tokens. No dependencies or schema changes.

## Constraints

- Keep financial calculations unchanged.
- Never label an unverified event as the cause of a balance change.
- Compare selected snapshot date against the prior saved snapshot date, not the chart's sampled predecessor.
- Build verification only; repository instructions prohibit running tests unless requested.

## Tasks

1. Add chart selection callback for pointer, touch, click, and keyboard changes; retain hover value behavior.
2. In Net Worth History, derive exact net-worth and component deltas from the selected and previous snapshots.
3. List dated PURCHASE, SALE, EXPENSE, INCOME, REVERSAL, and TRANSFER records in the interval. Label their amounts as recorded cash activity; keep transfer net effect neutral.
4. Show an explicit first-snapshot state and a clear note for inventory value changes not attributable from retained history.
5. Verify with `git diff --check` and the production build.
