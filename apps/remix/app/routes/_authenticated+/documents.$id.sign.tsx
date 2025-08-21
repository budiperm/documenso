import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';

import { DocumentSigningPageView } from '~/components/general/document-signing/document-signing-page-view';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';

export async function loader({ params, request }: { params: any; request: Request }) {
  const { user } = await getSession(request);
  const { id } = params;
  const documentId = Number(id);
  const documentRootPath = '/documents';

  if (Number.isNaN(documentId)) {
    throw redirect(documentRootPath);
  }

  try {
    const document = await getDocumentWithDetailsById({
      userId: user.id,
      teamId: 0,
      documentId,
    });

    if (!document) {
      throw redirect(documentRootPath);
    }

    // Find the self-signing recipient (current user)
    const selfSigningRecipient = document.recipients.find(
      (recipient: any) => recipient.email === user.email && recipient.role === 'SIGNER',
    );

    if (!selfSigningRecipient) {
      throw redirect(`${documentRootPath}/${documentId}`);
    }

    // Get fields for this recipient
    const recipientFields = document.fields.filter(
      (field: any) => field.recipientId === selfSigningRecipient.id,
    );

    const completedFields = document.fields.filter((f: any) => f.inserted);

  return superLoaderJson({
      document,
      recipient: selfSigningRecipient,
      fields: recipientFields,
      completedFields,
      documentRootPath,
      isRecipientsTurn: true,
      includeSenderDetails: false,
    });
  } catch {
    throw redirect(documentRootPath);
  }
}

export default function DocumentSigningPage() {
  const { document, recipient, fields, completedFields, documentRootPath, isRecipientsTurn, includeSenderDetails } =
    useSuperLoaderData<typeof loader>();
  const { sessionData } = useOptionalSession();
  const user = sessionData?.user;

  const recipientWithFields = { ...recipient, fields } as const;

  return (
    <DocumentSigningProvider
      email={recipient.email}
      fullName={user?.email === recipient.email ? user?.name : recipient.name}
      signature={user?.email === recipient.email ? user?.signature : undefined}
      typedSignatureEnabled={document.documentMeta?.typedSignatureEnabled}
      uploadSignatureEnabled={document.documentMeta?.uploadSignatureEnabled}
      drawSignatureEnabled={document.documentMeta?.drawSignatureEnabled}
    >
      <DocumentSigningPageView
        document={document as any}
        recipient={recipientWithFields as any}
        fields={fields}
        completedFields={completedFields}
        isRecipientsTurn={isRecipientsTurn}
        includeSenderDetails={includeSenderDetails}
      />
    </DocumentSigningProvider>
  );
}
