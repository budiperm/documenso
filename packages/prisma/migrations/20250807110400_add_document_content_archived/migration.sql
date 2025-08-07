-- Add content archived tracking fields to Document table
ALTER TABLE "Document" ADD COLUMN "contentArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "archivedAt" TIMESTAMP(3);
