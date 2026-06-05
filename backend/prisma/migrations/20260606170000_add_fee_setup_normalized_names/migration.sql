ALTER TABLE "fee_particulars" ADD COLUMN "normalized_name" TEXT;
ALTER TABLE "fee_types" ADD COLUMN "normalized_name" TEXT;

WITH normalized_particulars AS (
  SELECT
    "id",
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')) AS base_name,
    row_number() OVER (
      PARTITION BY "school_id", "academic_session_id", lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
      ORDER BY "created_at", "id"
    ) AS duplicate_rank
  FROM "fee_particulars"
)
UPDATE "fee_particulars" fp
SET "normalized_name" = CASE
  WHEN np.duplicate_rank = 1 THEN np.base_name
  ELSE np.base_name || ' #' || substring(fp."id"::text, 1, 8)
END
FROM normalized_particulars np
WHERE fp."id" = np."id";

WITH normalized_fee_types AS (
  SELECT
    "id",
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')) AS base_name,
    row_number() OVER (
      PARTITION BY "school_id", "academic_session_id", lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
      ORDER BY "created_at", "id"
    ) AS duplicate_rank
  FROM "fee_types"
)
UPDATE "fee_types" ft
SET "normalized_name" = CASE
  WHEN nft.duplicate_rank = 1 THEN nft.base_name
  ELSE nft.base_name || ' #' || substring(ft."id"::text, 1, 8)
END
FROM normalized_fee_types nft
WHERE ft."id" = nft."id";

ALTER TABLE "fee_particulars" ALTER COLUMN "normalized_name" SET NOT NULL;
ALTER TABLE "fee_types" ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE UNIQUE INDEX "unique_fee_particular_normalized_name" ON "fee_particulars"("school_id", "academic_session_id", "normalized_name");
CREATE UNIQUE INDEX "unique_fee_type_normalized_name" ON "fee_types"("school_id", "academic_session_id", "normalized_name");