-- Rename UserRole enum value superadmin -> owner
ALTER TYPE "UserRole" RENAME VALUE 'superadmin' TO 'owner';
