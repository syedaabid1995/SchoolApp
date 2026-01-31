CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools" ("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "users_school_id_email_key" ON "users" ("school_id", "email");
CREATE INDEX "users_school_id_idx" ON "users" ("school_id");

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" "RoleName" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles" ("name");

CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions" ("code");

CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE
);

CREATE INDEX "user_roles_role_id_idx" ON "user_roles" ("role_id");

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE
);

CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" ("permission_id");
