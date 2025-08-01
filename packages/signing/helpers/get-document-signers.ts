import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../lib/types/document-audit-logs';
import { parseDocumentAuditLogData } from '../../lib/utils/document-audit-logs';

export type GetDocumentSignersOptions = {
  documentId: number;
};

export type SignerInfo = {
  name: string;
  signedAt: Date;
};

/**
 * Retrieves all signers who have completed signing a document from the DocumentAuditLog table.
 * 
 * @param documentId - The ID of the document to get signers for
 * @returns Array of signer information with names and signature timestamps
 */
export const getDocumentSigners = async ({ documentId }: GetDocumentSignersOptions): Promise<SignerInfo[]> => {
  const auditLogs = await prisma.documentAuditLog.findMany({
    where: {
      documentId,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
    },
    orderBy: {
      createdAt: 'asc', // Get signers in the order they signed
    },
  });

  const signers: SignerInfo[] = [];

  for (const log of auditLogs) {
    try {
      const parsedLog = parseDocumentAuditLogData(log);
      
      if (parsedLog.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED) {
        // Use the recipient name from the audit log data, fallback to name or email from the log
        const signerName = parsedLog.data.recipientName || parsedLog.name || parsedLog.email;
        
        if (signerName) {
          // Check if this signer is already in the list to avoid duplicates
          const existingSigner = signers.find(s => s.name === signerName);
          if (!existingSigner) {
            signers.push({
              name: signerName,
              signedAt: parsedLog.createdAt,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse audit log ${log.id}:`, error);
      // Fallback to using the name or email from the raw log
      const signerName = log.name || log.email;
      if (signerName) {
        const existingSigner = signers.find(s => s.name === signerName);
        if (!existingSigner) {
          signers.push({
            name: signerName,
            signedAt: log.createdAt,
          });
        }
      }
    }
  }

  return signers;
};

/**
 * Formats signer information with clear visual separators for PDF signature reason.
 * Uses pipe separators since line breaks don't work reliably in PDF signature reason field.
 * 
 * @param signers - Array of signer information
 * @returns Formatted string for PDF signature reason
 */
export const formatSignersForPdf = (signers: SignerInfo[]): string => {
  if (signers.length === 0) {
    return 'Signed by Documenso';
  }

  // Get timezone from environment variable with fallback
  const defaultTimezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Asia/Jakarta';

  const signerLines = signers.map((signer, index) => {
    // Convert to configured timezone
    const formattedDate = signer.signedAt.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: defaultTimezone,
      timeZoneName: 'short',
    });
    
    return `${index + 1}. ${signer.name} - ${formattedDate}`;
  });

  // Use double pipe separators for clear visual distinction
  return signerLines.join(' || ');
};

/**
 * Alternative format using clear visual separators when line breaks don't work
 */
export const formatSignersForPdfFallback = (signers: SignerInfo[]): string => {
  if (signers.length === 0) {
    return 'Signed by Documenso';
  }

  // Get timezone from environment variable with fallback
  const defaultTimezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Asia/Jakarta';

  const signerLines = signers.map((signer, index) => {
    // Convert to configured timezone
    const formattedDate = signer.signedAt.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: defaultTimezone,
      timeZoneName: 'short',
    });
    
    return `${index + 1}. ${signer.name} - ${formattedDate}`;
  });

  // Use clear separators: double pipe with spaces
  return `Signed by: ${signerLines.join(' || ')}`;
};
