-- Adds the column needed for the new "Parts Breakdown" snapshot feature.
-- Run this once in Supabase's SQL editor before deploying the updated server.js —
-- if you deploy the code first without this column existing, every sale save will
-- fail with a "column build_parts_snapshot does not exist" error.

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS build_parts_snapshot JSONB;

-- Verify it was added:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'build_parts_snapshot';
