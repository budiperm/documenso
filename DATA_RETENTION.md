# Data Retention Feature in Docker

This Docker build includes a comprehensive data retention system that automatically deletes old document content while preserving essential metadata.

## Environment Variables

Configure the data retention feature using these environment variables in your Docker setup:

```bash
# Enable/disable data retention (default: false)
NEXT_PRIVATE_DATA_RETENTION_ENABLED=true

# Number of days to retain documents (default: 90)
NEXT_PRIVATE_DATA_RETENTION_DAYS=90d

# Only clean up completed documents (default: true)
NEXT_PRIVATE_DATA_RETENTION_COMPLETED_ONLY=true

# Schedule cleanup interval (default: 24h)
# Format: "number unit" where unit is m/h/d (minutes/hours/days)
# Examples: "30m", "2h", "24h", "1d", "7d"
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=24h
```

## Docker Compose Example

```yaml
version: '3.8'
services:
  documenso:
    image: documenso-base:latest
    environment:
      - NEXT_PRIVATE_DATA_RETENTION_ENABLED=true
      - NEXT_PRIVATE_DATA_RETENTION_DAYS=90
      - NEXT_PRIVATE_DATA_RETENTION_COMPLETED_ONLY=true
      - NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=24h
      # ... other environment variables
    ports:
      - "3000:3000"
    depends_on:
      - postgres
```

## How It Works

1. **Automatic Startup**: The data retention scheduler starts automatically with the application server
2. **Configurable Schedule**: Runs at your specified interval (minutes, hours, or days) to clean up old document data
3. **PDF Content Deletion**: Permanently removes PDF file content for documents older than the specified retention period
4. **Metadata Preservation**: Keeps document metadata, signatures, and audit logs for compliance
5. **Visual Indicators**: Documents show "Deleted" status with darker background in the document list
6. **Disabled Actions**: Download and action buttons are disabled for deleted documents

## User Experience Features

### Document List Enhancements
- **Deleted Status**: Documents show "Deleted" status with archive icon instead of "Completed"
- **Visual Distinction**: Deleted documents have darker gray background for easy identification
- **Disabled Downloads**: Download button is grayed out and non-functional for deleted documents
- **Disabled Actions**: Three-dot menu is removed entirely for deleted documents
- **Information Panel**: Clear notice about active data retention policy with dynamic timing

### PDF Viewer
- **Clear Messaging**: When viewing deleted documents, users see informative message instead of errors
- **Content Explanation**: Explains that PDF content is removed but metadata is preserved
- **Professional Design**: Maintains consistent UI/UX even for deleted documents

## Schedule Examples

```bash
# Every 30 minutes (for testing)
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=30m

# Every 2 hours
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=2h

# Every 24 hours (default)
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=24h

# Every 1 day (same as 24h)
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=1d

# Every 7 days (weekly cleanup)
NEXT_PRIVATE_DATA_RETENTION_SCHEDULE=7d
```

## Manual Testing & Cleanup

You can manually mark documents as deleted for testing:

```sql
-- Mark a specific document as deleted
UPDATE "Document" 
SET "contentArchived" = true, "archivedAt" = NOW()
WHERE id = 'your-document-id';

-- Mark old completed documents as deleted
UPDATE "Document" 
SET "contentArchived" = true, "archivedAt" = NOW()
WHERE "status" = 'COMPLETED' 
AND "completedAt" < NOW() - INTERVAL '30 days'
AND "contentArchived" = false;
```

You can also check cleanup statistics:

```javascript
// Check which documents would be affected
const retentionDays = 30;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

const documentsToDelete = await prisma.document.count({
  where: {
    status: 'COMPLETED',
    completedAt: { lt: cutoffDate },
    contentArchived: false,
  },
});
```

## Monitoring & Logs

The data retention system provides comprehensive logging:

```bash
# Docker startup logs will show:
✅ Data retention scheduler started successfully
ℹ️  Data retention is enabled (30 days retention)
ℹ️  Data retention scheduler will start automatically with the application

# During cleanup operations:
ℹ️  Running manual data retention cleanup...
✅ Data retention cleanup completed: X documents processed
❌ Data retention error: [error details]
```

## Storage Impact & Benefits

The data retention system helps manage costs and compliance by:
- **Significant Storage Reduction**: Removes large PDF files after retention period
- **Maintains Document Structure**: All metadata, signatures, and audit trails preserved
- **Legal Compliance**: Configurable retention periods support various regulatory requirements
- **User-Friendly Experience**: Clear visual indicators and messaging
- **No Data Loss**: Important document information always accessible

## Database Changes

The system adds two fields to the Document model:
- `contentArchived`: Boolean flag indicating if PDF content has been deleted
- `archivedAt`: Timestamp when the content was deleted

## Security & Compliance

- All deletion operations are logged in the audit system
- Document metadata, signatures, and audit logs are never removed
- Configurable retention periods support GDPR, HIPAA, and other compliance requirements
- Clear user communication about data deletion policies
- Visual indicators prevent user confusion about document status

## Troubleshooting

### Common Issues

**Error: "Data retention scheduler failed to start"**
- Check that `NEXT_PRIVATE_DATA_RETENTION_ENABLED=true` is set
- Verify database connectivity and migration completion
- Review application logs for specific error messages

**No cleanup happening**
- Ensure `NODE_ENV=production` for automatic scheduling
- Check that documents are older than the retention period specified in `NEXT_PRIVATE_DATA_RETENTION_DAYS`
- Verify `NEXT_PRIVATE_DATA_RETENTION_SCHEDULE` format is correct (e.g., "24h", "30m", "1d")
- Check Docker logs for scheduler startup messages

**Invalid schedule format error**
- Use correct format: number + unit (m/h/d)
- ✅ Valid: "30m", "2h", "24h", "1d", "7d"
- ❌ Invalid: "24", "2.5h", "daily", "once"
- System will default to 24h for invalid formats

**Documents not showing as "Deleted" in UI**
- Verify database migration completed successfully
- Check that `contentArchived` field exists in Document table
- Rebuild Docker image to ensure latest UI changes are included
- Clear browser cache to refresh JavaScript bundles

**Download buttons still working for deleted documents**
- Ensure you're using the latest Docker image build
- Check browser developer tools for JavaScript errors
- Verify the document list is passing `contentArchived` field correctly

### Verification Steps

1. **Check Startup Logs:**
   ```bash
   docker logs your-container-name | grep -i retention
   
   # Should show:
   # Data retention is enabled (X days retention)
   # ✅ Data retention scheduler started successfully
   ```

2. **Test Document Status:**
   - Upload and complete a document
   - Mark it as deleted using SQL update
   - Refresh document list to see "Deleted" status and gray background
   - Try clicking download - should be disabled

3. **Verify Information Panel:**
   - Check document list page for blue info box
   - Should show: "Document content is automatically deleted in [X days/hours]"
   - Time should match your `NEXT_PRIVATE_DATA_RETENTION_SCHEDULE` setting

4. **Test PDF Viewer:**
   - Click
