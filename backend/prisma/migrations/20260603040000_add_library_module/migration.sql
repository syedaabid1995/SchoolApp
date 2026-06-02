DO $$
BEGIN
  CREATE TYPE "LibraryMemberType" AS ENUM ('STUDENT', 'TEACHER', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "LibraryIssueStatus" AS ENUM ('ISSUED', 'RETURNED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library_book_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_book_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_book_categories_school_id_name_key" ON "library_book_categories"("school_id", "name");
CREATE INDEX IF NOT EXISTS "library_book_categories_school_id_idx" ON "library_book_categories"("school_id");

DO $$
BEGIN
  ALTER TABLE "library_book_categories" ADD CONSTRAINT "library_book_categories_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library_books" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "book_number" TEXT,
  "isbn_number" TEXT,
  "publisher_name" TEXT,
  "author_name" TEXT,
  "rack_number" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" DECIMAL(10,2),
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_books_school_id_book_number_key" ON "library_books"("school_id", "book_number");
CREATE UNIQUE INDEX IF NOT EXISTS "library_books_school_id_isbn_number_key" ON "library_books"("school_id", "isbn_number");
CREATE INDEX IF NOT EXISTS "library_books_school_id_idx" ON "library_books"("school_id");
CREATE INDEX IF NOT EXISTS "library_books_category_id_idx" ON "library_books"("category_id");
CREATE INDEX IF NOT EXISTS "library_books_subject_id_idx" ON "library_books"("subject_id");

DO $$
BEGIN
  ALTER TABLE "library_books" ADD CONSTRAINT "library_books_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_books" ADD CONSTRAINT "library_books_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "library_book_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_books" ADD CONSTRAINT "library_books_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "member_type" "LibraryMemberType" NOT NULL,
  "member_code" TEXT NOT NULL,
  "student_id" UUID,
  "staff_id" UUID,
  "full_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "photo_url" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "canceled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_members_school_id_member_type_member_code_key" ON "library_members"("school_id", "member_type", "member_code");
CREATE INDEX IF NOT EXISTS "library_members_school_id_idx" ON "library_members"("school_id");
CREATE INDEX IF NOT EXISTS "library_members_student_id_idx" ON "library_members"("student_id");
CREATE INDEX IF NOT EXISTS "library_members_staff_id_idx" ON "library_members"("staff_id");
CREATE INDEX IF NOT EXISTS "library_members_active_idx" ON "library_members"("active");

DO $$
BEGIN
  ALTER TABLE "library_members" ADD CONSTRAINT "library_members_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_members" ADD CONSTRAINT "library_members_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_members" ADD CONSTRAINT "library_members_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "book_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "return_date" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "status" "LibraryIssueStatus" NOT NULL DEFAULT 'ISSUED',
  "created_by_id" UUID NOT NULL,
  "returned_by_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_issues_school_id_idx" ON "library_issues"("school_id");
CREATE INDEX IF NOT EXISTS "library_issues_book_id_idx" ON "library_issues"("book_id");
CREATE INDEX IF NOT EXISTS "library_issues_member_id_idx" ON "library_issues"("member_id");
CREATE INDEX IF NOT EXISTS "library_issues_status_idx" ON "library_issues"("status");
CREATE INDEX IF NOT EXISTS "library_issues_created_by_id_idx" ON "library_issues"("created_by_id");
CREATE INDEX IF NOT EXISTS "library_issues_returned_by_id_idx" ON "library_issues"("returned_by_id");

DO $$
BEGIN
  ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_book_id_fkey"
    FOREIGN KEY ("book_id") REFERENCES "library_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "library_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_returned_by_id_fkey"
    FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
