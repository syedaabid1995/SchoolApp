CREATE TABLE "academic_years" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "start_date" timestamptz NOT NULL,
  "end_date" timestamptz NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "academic_years_school_id_name_key" ON "academic_years" ("school_id", "name");
CREATE INDEX "academic_years_school_id_idx" ON "academic_years" ("school_id");

CREATE TABLE "terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "academic_year_id" uuid NOT NULL,
  "name" text NOT NULL,
  "start_date" timestamptz NOT NULL,
  "end_date" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "terms_academic_year_id_name_key" ON "terms" ("academic_year_id", "name");
CREATE INDEX "terms_academic_year_id_idx" ON "terms" ("academic_year_id");

CREATE TABLE "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "classes_school_id_name_key" ON "classes" ("school_id", "name");
CREATE INDEX "classes_school_id_idx" ON "classes" ("school_id");

CREATE TABLE "sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "sections_class_id_name_key" ON "sections" ("class_id", "name");
CREATE INDEX "sections_class_id_idx" ON "sections" ("class_id");

CREATE TABLE "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "subjects_school_id_name_key" ON "subjects" ("school_id", "name");
CREATE INDEX "subjects_school_id_idx" ON "subjects" ("school_id");
