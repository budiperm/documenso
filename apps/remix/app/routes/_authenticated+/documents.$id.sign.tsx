import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getDocumentWithDetailsById } from '@documenso/lib/server-only/document/get-document-with-details-by-id';
import { Badge } from '@documenso/ui/primitives/badge';

import { DocumentSigningPageView } from '~/components/general/document-signing/document-signing-page-view';
import { DocumentSigningProvider } from '~/components/general/document-signing/document-signing-provider';
import { superLoaderJson, useSuperLoaderData } from '~/utils/super-json-loader';

import type { Route } from './+types/documents.$id.sign';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const { id } = params;

  const documentId = Number(id);

  const documentRootPath = '/documents';

  if (Number.isNaN(documentId)) {
    return redirect(documentRootPath);
  }

  const document = await getDocumentWithDetailsById({
    userId: user.id,
    teamId: undefined,
    documentId,
  });

  if (!document) {
    return redirect(documentRootPath);
  }

  // Check if this is a self-signing document
  const selfSigningRecipient = document.recipients.find(
    (recipient) => recipient.email === user.email && recipient.role === RecipientRole.SIGNER,
  );

  if (!selfSigningRecipient) {
    // Redirect to view page if not a self-signing document
    return redirect(`${documentRootPath}/${documentId}`);
  }

  // Check if already signed
  if (selfSigningRecipient.signingStatus === SigningStatus.SIGNED) {
    return redirect(`${documentRootPath}/${documentId}`);
  }

  // Get fields for this recipient
  const fields = document.fields.filter((field) => field.recipientId === selfSigningRecipient.id);
  const completedFields = document.fields.filter(
    (field) => field.recipientId === selfSigningRecipient.id && field.inserted,
  );

  return superLoaderJson({
    document,
    recipient: selfSigningRecipient,
    fields,
    completedFields,
    documentRootPath,
  });
}

export default function DocumentSelfSignPage() {
  const { _ } = useLingui();
  const { user } = useSession();
  const { document, recipient, fields, completedFields, documentRootPath } =
    useSuperLoaderData<typeof loader>();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <Link
        to={documentRootPath}
        className="text-muted-foreground hover:text-foreground mb-8 flex items-center text-sm"
      >
        <ChevronLeft className="mr-2 h-5 w-5" />
        <Trans>Back to Documents</Trans>
      </Link>

      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold md:text-3xl" title={document.title}>
            {document.title}
          </h1>

          <p className="text-muted-foreground mt-2.5 text-sm">
            <Trans>Sign this document</Trans>
          </p>
        </div>

        <div className="flex items-center gap-x-4">
          <Badge variant="neutral">
            <Trans>Self-Signing Document</Trans>
          </Badge>
        </div>
      </div>

      <DocumentSigningProvider 
        document={document} 
        recipient={recipient} 
        token={recipient.token}
        email={user.email}
        fullName={user.name || ''}
        signature=""
        redirectUrl=""
      >
        <DocumentSigningPageView
          recipient={recipient}
          document={document}
          fields={fields}
          completedFields={completedFields}
          isRecipientsTurn={true}
          includeSenderDetails={false}
        />
      </DocumentSigningProvider>
    </div>
  );
}
