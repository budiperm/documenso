import { match } from 'ts-pattern';

import { env } from '@documenso/lib/utils/env';

import { signWithGoogleCloudHSM } from './transports/google-cloud-hsm';
import { signWithLocalCert } from './transports/local-cert';

export type SignOptions = {
  pdf: Buffer;
  signers?: string[];
  documentId?: number;
};

export const signPdf = async ({ pdf, signers, documentId }: SignOptions) => {
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  // If documentId is provided but no signers, get signers from audit logs
  let actualSigners = signers;
  if (!signers && documentId) {
    try {
      const { getDocumentSigners, formatSignersForPdf } = await import('./helpers/get-document-signers');
      const signerInfo = await getDocumentSigners({ documentId });
      
      // Format the signers with timestamps into a single string for the reason field
      const formattedSigners = formatSignersForPdf(signerInfo);
      actualSigners = [formattedSigners]; // Pass as single string since reason field is a single text field
    } catch (error) {
      console.warn('Failed to get document signers:', error);
      actualSigners = [];
    }
  }

  return await match(transport)
    .with('local', async () => signWithLocalCert({ pdf, signers: actualSigners, documentId }))
    .with('gcloud-hsm', async () => signWithGoogleCloudHSM({ pdf, signers: actualSigners, documentId }))
    .otherwise(() => {
      throw new Error(`Unsupported signing transport: ${transport}`);
    });
};
