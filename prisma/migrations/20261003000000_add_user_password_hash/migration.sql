-- Add optional password hash for admin username/password login.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
