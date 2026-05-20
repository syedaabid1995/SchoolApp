ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "domain_url" TEXT;

WITH normalized AS (
  SELECT
    "id",
    lower(trim(both '-' from regexp_replace(regexp_replace("code", '[^a-zA-Z0-9-]+', '-', 'g'), '-+', '-', 'g'))) AS "base_subdomain"
  FROM "schools"
  WHERE "subdomain" IS NULL
    AND "code" IS NOT NULL
),
ranked AS (
  SELECT
    "id",
    "base_subdomain",
    row_number() OVER (PARTITION BY "base_subdomain" ORDER BY "id") AS "duplicate_index"
  FROM normalized
  WHERE "base_subdomain" <> ''
)
UPDATE "schools" AS "s"
SET "subdomain" = CASE
  WHEN "ranked"."duplicate_index" = 1 THEN left("ranked"."base_subdomain", 63)
  ELSE left("ranked"."base_subdomain", 54) || '-' || left("s"."id"::text, 8)
END
FROM "ranked"
WHERE "s"."id" = "ranked"."id"
  AND "s"."subdomain" IS NULL;

UPDATE "schools"
SET "domain_url" = 'https://' || "subdomain" || '.akademify.techstageit.com'
WHERE "domain_url" IS NULL
  AND "subdomain" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "schools_subdomain_key" ON "schools"("subdomain");
