-- F2-M6 extension: add is_starred to folders table
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;
