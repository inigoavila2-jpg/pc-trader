# Project organization rules

These rules apply to hand-written application source code.

- Keep the app's existing behavior the same while reorganizing it.
- Work through one folder at a time and keep each change easy to review.
- Before creating a file, check whether the needed file already exists.
- Put screen-level code in `src/pages/`.
- Put reusable UI pieces in `src/components/`.
- Put data loading, saving, and persistence code in `src/data/`.
- Give each source file one clear job.
- Keep hand-written application source files at 300 lines or fewer. Split code by responsibility when a file grows beyond that limit.
- Keep the app entry point small and make it clear how screens connect.
- Do not reorganize generated files, dependency lockfiles, or reference material just to meet the source-file line limit.

## Performance rules

Treat 200 ms as a user-perceived performance goal across the app. Measure on representative devices and data before claiming a target is met; network, browser, hosting, and third-party service latency are outside the code's direct control.

- Keep long main-thread tasks below 50 ms. Keep page-load and screen-change Total Blocking Time below 200 ms.
- For work expected to take longer than 100 ms, show immediate feedback within 50 ms. Use optimistic updates only when failure can be handled and the user can see the saved/error state.
- Target Interaction to Next Paint (INP) below 200 ms at the 75th percentile on representative production traffic.
- Target API time to first byte and completion below 200 ms at the 95th percentile under representative production load. Measure server work separately from network and third-party latency; don't promise this without measurements.
- Keep initial JavaScript and screen changes small with route/screen-level code splitting. Defer screens and features until first use when that preserves behavior. Keep form state when users switch screens.
- Profile before adding memoization. Use `memo`, `useMemo`, and `useCallback` only where they avoid measured work or stable-prop churn.
- Keep database reads parallel when independent, select only required columns, bound growing payloads where behavior allows, avoid N+1 queries, and add indexes only after checking the real schema and query plan.
- Cache read-heavy data only when freshness, invalidation, and multi-user correctness are defined. Never cache user data across users.
- Move slow external work off the request path only when a durable queue or a clear failure/retry path preserves data and user-visible status. Do not report a write as saved before it is durable.
- Before and after performance changes, run the production build and compare bundle sizes. For latency claims, record the device, data volume, load, and measurement method; do not substitute estimates for measurements.
