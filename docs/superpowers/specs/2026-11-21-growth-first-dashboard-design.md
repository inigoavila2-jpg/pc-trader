# Business Overview: Growth First, Honest Trend

## Intent

Make the overview feel balanced and encouraging by surfacing genuine business wins first, without hiding or softening the underlying net-worth history.

## Approaches

- **Recolor only:** neutralize the red trend and delta but keep the current order. Rejected because the first impression would still be a decline.
- **Growth-first hierarchy with neutral trend:** selected. Promote the existing period profit and ROI metrics, then show net worth and its accurately labeled trend in slate/blue.
- **Hide or smooth declines:** rejected because it would obscure financial history and reduce trust.

## Design

- Keep the existing period selector and calculations. Place the selected-period profit and ROI metrics before the net-worth history; with All time selected, this foregrounds +₱115,269 profit and 53.4% ROI.
- Keep net worth, available money, inventory, and both snapshot comparisons visible. Use muted slate for ordinary negative deltas; preserve their signs and labels.
- Use existing semantic theme tokens so the requested light-theme values remain exact while dark mode keeps its accessible variants:
  - Profit, ROI, and available money: positive `rgb(31, 122, 77)`.
  - Unsold inventory: accent `rgb(37, 42, 49)`.
  - Total business net worth: text `rgb(24, 33, 43)`.
- Use the information/brand tone for the net-worth trend, with a subtle fill. Reserve red for an actual total net worth below zero; use warning/amber rather than red for other negative metrics or operational alerts.
- Keep the chart's keyboard and pointer inspection, labels, snapshot dates, and activity-detail path. Do not imply that unrelated profit or cash-flow figures caused a net-worth change.

## Scope and Constraints

- Update only the Business Overview presentation and its net-worth chart semantics.
- Do not change financial calculations, snapshot data, database schema, or history records.
- Reuse existing React components and theme tokens; add no dependencies.
- Check light/dark contrast and desktop/mobile layout. Preserve accessible chart labels and keyboard operation.
