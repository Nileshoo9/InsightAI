-- Preserve existing reports before enforcing the non-null Insight.insightsText schema.
UPDATE "Insight"
SET "insightsText" = COALESCE(NULLIF("description", ''), 'No narrative was saved for this legacy report.')
WHERE "insightsText" IS NULL;
