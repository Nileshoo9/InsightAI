-- Additive compatibility patch only. Do not run `prisma db push --accept-data-loss`
-- against this database until its existing Dataset/AnalysisRun schema is reconciled.
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "rawData" JSONB;
