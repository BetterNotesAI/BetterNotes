-- Prevent duplicate notebook input rows for the same uploaded object.

WITH ranked_inputs AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, folder_id, storage_path
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.folder_inputs
)
DELETE FROM public.folder_inputs AS input
USING ranked_inputs AS ranked
WHERE input.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_inputs_unique_uploaded_object
  ON public.folder_inputs(user_id, folder_id, storage_path);
