-- SQL script to test document archival
-- This will mark the first completed document as archived for testing

UPDATE "Document" 
SET "contentArchived" = true, "archivedAt" = NOW()
WHERE "status" = 'COMPLETED' 
  AND "contentArchived" = false
LIMIT 1;

-- Check the result
SELECT id, title, status, "contentArchived", "archivedAt" 
FROM "Document" 
WHERE "contentArchived" = true
LIMIT 5;
