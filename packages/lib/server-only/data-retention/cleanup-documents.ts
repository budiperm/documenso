/**
 * Data retention service for cleaning up old document PDF data
 * This service removes PDF content while preserving metadata for documents older than the retention period
 */

import { prisma } from '@documenso/prisma';
import type { DocumentStatus } from '@documenso/prisma/client';
import { DATA_RETENTION_DAYS, DATA_RETENTION_COMPLETED_ONLY, IS_DATA_RETENTION_ENABLED } from '../../constants/auth';

export interface CleanupStats {
  processedDocuments: number;
  deletedDocumentData: number;
  totalBytesFreed: number;
  totalDataSizeBeforeCleanup: number;
  cleanupDurationMs: number;
  oldestDocumentProcessed: Date | null;
  documentsSkipped: number;
  errors: string[];
}

export interface StorageStats {
  totalDocuments: number;
  documentsWithData: number;
  documentsWithoutData: number;
  estimatedDataSizeBytes: number;
  isEnabled: boolean;
  retentionDays: number;
  completedOnly: boolean;
}

/**
 * Main function to clean up old document data
 */
export async function cleanupOldDocumentData(): Promise<CleanupStats> {
  if (!IS_DATA_RETENTION_ENABLED) {
    throw new Error('Data retention is not enabled');
  }

  const startTime = Date.now();
  const retentionCutoff = new Date(Date.now() - (DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  const result: CleanupStats = {
    processedDocuments: 0,
    deletedDocumentData: 0,
    totalBytesFreed: 0,
    totalDataSizeBeforeCleanup: 0,
    cleanupDurationMs: 0,
    oldestDocumentProcessed: null,
    documentsSkipped: 0,
    errors: []
  };

  try {
    const statusCondition = DATA_RETENTION_COMPLETED_ONLY 
      ? 'COMPLETED' as DocumentStatus
      : { in: ['COMPLETED', 'PENDING'] as DocumentStatus[] };

    // Find documents older than retention period with data
    const documentsToProcess = await prisma.document.findMany({
      where: {
        updatedAt: {
          lt: retentionCutoff,
        },
        status: statusCondition,
        contentArchived: false, // Only process documents that haven't been archived yet
        documentData: {
          data: {
            not: '',
          },
        },
      },
      include: {
        documentData: true,
      },
      take: 100, // Process in batches to avoid memory issues
    });

    if (documentsToProcess.length === 0) {
      result.cleanupDurationMs = Date.now() - startTime;
      return result;
    }

    // Track oldest document
    result.oldestDocumentProcessed = Math.min(
      ...documentsToProcess.map(doc => doc.updatedAt.getTime())
    ) ? new Date(Math.min(...documentsToProcess.map(doc => doc.updatedAt.getTime()))) : null;

    for (const document of documentsToProcess) {
      try {
        let documentSizeCleaned = 0;

        // Process the document data entry
        if (document.documentData && document.documentData.data) {
          try {
            const dataSize = document.documentData.data.length;
            
            // Clean the document data
            await prisma.documentData.update({
              where: { id: document.documentData.id },
              data: {
                data: '',
                initialData: '',
              },
            });

            // Mark document as content archived
            await prisma.document.update({
              where: { id: document.id },
              data: {
                contentArchived: true,
                archivedAt: new Date(),
              },
            });

            documentSizeCleaned += dataSize;
            result.deletedDocumentData++;
          } catch (error) {
            result.errors.push(`Error processing document data ${document.documentData.id}: ${error}`);
          }
        }

        if (documentSizeCleaned > 0) {
          result.processedDocuments++;
          result.totalBytesFreed += documentSizeCleaned;
        } else {
          result.documentsSkipped++;
        }
      } catch (error) {
        result.errors.push(`Error processing document ${document.id}: ${error}`);
        result.documentsSkipped++;
      }
    }

    result.cleanupDurationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.errors.push(`Fatal error during cleanup: ${error}`);
    result.cleanupDurationMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Get estimated storage statistics before cleanup
 */
export async function getCleanupStats(): Promise<StorageStats> {
  const retentionCutoff = new Date(Date.now() - (DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  const statusCondition = DATA_RETENTION_COMPLETED_ONLY 
    ? 'COMPLETED' as DocumentStatus
    : { in: ['COMPLETED', 'PENDING'] as DocumentStatus[] };

  // Get total documents
  const totalDocuments = await prisma.document.count();

  // Get documents with data that would be affected
  const documentsWithData = await prisma.document.count({
    where: {
      updatedAt: {
        lt: retentionCutoff,
      },
      status: statusCondition,
      documentData: {
        data: {
          not: '',
        },
      },
    },
  });

  const documentsWithoutData = totalDocuments - documentsWithData;

  // Sample some documents to estimate data size
  let estimatedDataToDelete = 0;
  const sampleDocs = await prisma.document.findMany({
    where: {
      updatedAt: {
        lt: retentionCutoff,
      },
      status: statusCondition,
      documentData: {
        data: {
          not: '',
        },
      },
    },
    include: {
      documentData: true,
    },
    take: 10,
  });

  // Calculate estimated size from sample
  let sampleCount = 0;
  for (const doc of sampleDocs) {
    if (doc.documentData && doc.documentData.data) {
      estimatedDataToDelete += doc.documentData.data.length;
      sampleCount++;
    }
  }

  // Extrapolate to all documents
  if (sampleCount > 0) {
    const avgDataSize = estimatedDataToDelete / sampleCount;
    const totalDocumentDataCount = await prisma.document.count({
      where: {
        updatedAt: {
          lt: retentionCutoff,
        },
        status: statusCondition,
        documentData: {
          data: {
            not: '',
          },
        },
      },
    });
    estimatedDataToDelete = avgDataSize * totalDocumentDataCount;
  }

  return {
    totalDocuments,
    documentsWithData,
    documentsWithoutData,
    estimatedDataSizeBytes: estimatedDataToDelete,
    isEnabled: IS_DATA_RETENTION_ENABLED,
    retentionDays: DATA_RETENTION_DAYS,
    completedOnly: DATA_RETENTION_COMPLETED_ONLY,
  };
}

/**
 * Get current storage statistics
 */
export async function getStorageStats(): Promise<{
  totalDocuments: number;
  totalDocumentData: number;
  documentsWithData: number;
  documentsWithoutData: number;
  estimatedTotalSizeBytes: number;
}> {
  const totalDocuments = await prisma.document.count();
  const totalDocumentData = await prisma.documentData.count();

  const documentsWithData = await prisma.document.count({
    where: {
      documentData: {
        data: {
          not: '',
        },
      },
    },
  });

  const documentsWithoutData = totalDocuments - documentsWithData;

  // Sample for size estimation
  const sampleDocs = await prisma.document.findMany({
    include: {
      documentData: true,
    },
    take: 10,
  });

  let estimatedTotalSize = 0;
  let sampleCount = 0;

  for (const doc of sampleDocs) {
    if (doc.documentData && doc.documentData.data) {
      estimatedTotalSize += doc.documentData.data.length;
      sampleCount++;
    }
  }

  if (sampleCount > 0) {
    const avgDataSize = estimatedTotalSize / sampleCount;
    const totalDataWithContent = await prisma.documentData.count({
      where: {
        data: {
          not: '',
        },
      },
    });
    estimatedTotalSize = avgDataSize * totalDataWithContent;
  }

  return {
    totalDocuments,
    totalDocumentData,
    documentsWithData,
    documentsWithoutData,
    estimatedTotalSizeBytes: estimatedTotalSize,
  };
}
