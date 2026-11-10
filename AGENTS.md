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
