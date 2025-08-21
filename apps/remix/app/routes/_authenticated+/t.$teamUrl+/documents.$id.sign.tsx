import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import { DocumentSigningPageView } from '~/components/general/document-signing/document-signing-page-view';
import { DocumentSigningAuthProvider } from '~/components/general/document-signing/document-signing-auth-provider';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';

export async function loader({ params, request }: { params: any; request: Request }) {
  const { user } = await getSession(request);
  const { teamUrl, id } = params;
  const documentId = Number(id);

  if (Number.isNaN(documentId)) {
    throw new Response('Invalid document ID', { status: 400 });
  }

  const team = await getTeamByUrl({ userId: user.id, teamUrl });
  const documentRootPath = formatDocumentsPath(teamUrl);

  try {
    const document = await getDocumentWithDetailsById({
      userId: user.id,
      teamId: team.id,
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
      includeSenderDetails: true,
    });
  } catch {
    throw redirect(documentRootPath);
  }
}

export default function TeamDocumentSigningPage() {
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
      <DocumentSigningAuthProvider
        documentAuthOptions={document.authOptions}
        recipient={recipient as any}
        user={user}
      >
        <DocumentSigningPageView
          document={document as any}
          recipient={recipientWithFields as any}
          fields={fields}
          completedFields={completedFields}
          isRecipientsTurn={isRecipientsTurn}
          includeSenderDetails={includeSenderDetails}
        />
      </DocumentSigningAuthProvider>
    </DocumentSigningProvider>
  );
}
