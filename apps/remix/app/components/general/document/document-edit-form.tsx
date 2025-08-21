import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentDistributionMethod, DocumentStatus } from '@prisma/client';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isValidLanguageCode } from '@documenso/lib/constants/i18n';
import {
  DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
  SKIP_QUERY_BATCH_META,
} from '@documenso/lib/constants/trpc';
import type { TDocument } from '@documenso/lib/types/document';
import { ZDocumentAccessAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import type { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddSettingsFormPartial } from '@documenso/ui/primitives/document-flow/add-settings';
import type { TAddSettingsFormSchema } from '@documenso/ui/primitives/document-flow/add-settings.types';
import { AddSignersFormPartial } from '@documenso/ui/primitives/document-flow/add-signers';
import type { TAddSignersFormSchema } from '@documenso/ui/primitives/document-flow/add-signers.types';
import { AddSubjectFormPartial } from '@documenso/ui/primitives/document-flow/add-subject';
import type { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { PDFViewer } from '@documenso/ui/primitives/pdf-viewer';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Button } from '@documenso/ui/primitives/button';

import { useCurrentTeam } from '~/providers/team';
import { useSession } from '@documenso/lib/client-only/providers/session';

export type DocumentEditFormProps = {
  className?: string;
  initialDocument: TDocument;
  documentRootPath: string;
};

type EditDocumentStep = 'settings' | 'signers' | 'fields' | 'subject';
const EditDocumentSteps: EditDocumentStep[] = ['settings', 'signers', 'fields', 'subject'];

export const DocumentEditForm = ({
  className,
  initialDocument,
  documentRootPath,
}: DocumentEditFormProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const navigate = useNavigate();
  const { user } = useSession();

  const [searchParams] = useSearchParams();
  const team = useCurrentTeam();

  const [isDocumentPdfLoaded, setIsDocumentPdfLoaded] = useState(false);

  const utils = trpc.useUtils();

  const { data: document, refetch: refetchDocument } =
    trpc.document.getDocumentWithDetailsById.useQuery(
      {
        documentId: initialDocument.id,
      },
      {
        initialData: initialDocument,
        ...SKIP_QUERY_BATCH_META,
      },
    );

  const { recipients, fields } = document;

  const { mutateAsync: updateDocument } = trpc.document.updateDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

  const { mutateAsync: setSigningOrderForDocument } =
    trpc.document.setSigningOrderForDocument.useMutation({
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
      onSuccess: (newData) => {
        utils.document.getDocumentWithDetailsById.setData(
          {
            documentId: initialDocument.id,
          },
          (oldData) => ({ ...(oldData || initialDocument), ...newData, id: Number(newData.id) }),
        );
      },
    });

  const { mutateAsync: addFields } = trpc.field.addFields.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: ({ fields: newFields }) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), fields: newFields }),
      );
    },
  });

  const { mutateAsync: setRecipients } = trpc.recipient.setDocumentRecipients.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: ({ recipients: newRecipients }) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), recipients: newRecipients }),
      );
    },
  });

  const { mutateAsync: sendDocument } = trpc.document.sendDocument.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (newData) => {
      utils.document.getDocumentWithDetailsById.setData(
        {
          documentId: initialDocument.id,
        },
        (oldData) => ({ ...(oldData || initialDocument), ...newData }),
      );
    },
  });

  const documentFlow: Record<EditDocumentStep, DocumentFlowStep> = {
    settings: {
      title: msg`General`,
      description: msg`Configure general settings for the document.`,
      stepIndex: 1,
    },
    signers: {
      title: msg`Add Signers`,
      description: msg`Add the people who will sign the document.`,
      stepIndex: 2,
    },
    fields: {
      title: msg`Add Fields`,
      description: msg`Add all relevant fields for each recipient.`,
      stepIndex: 3,
    },
    subject: {
      title: msg`Distribute Document`,
      description: msg`Choose how the document will reach recipients`,
      stepIndex: 4,
    },
  };

  const [step, setStep] = useState<EditDocumentStep>(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const searchParamStep = searchParams?.get('step') as EditDocumentStep | undefined;

    let initialStep: EditDocumentStep = 'settings';

    if (
      searchParamStep &&
      documentFlow[searchParamStep] !== undefined &&
      !(recipients.length === 0 && (searchParamStep === 'subject' || searchParamStep === 'fields'))
    ) {
      initialStep = searchParamStep;
    }

    return initialStep;
  });

  // Track if the user chose to self-sign so we can alter post-fields behavior
  const [isSelfSignMode, setIsSelfSignMode] = useState(false);

  const onSkipToFieldsSelfSign = async () => {
    try {
      if (!user?.email) {
        toast({
          title: _(msg`Error`),
          description: _(msg`You must be signed in with a verified email to self-sign.`),
          variant: 'destructive',
        });
        return;
      }

      // Replace recipients with the current user as the sole signer
      await setRecipients({
        documentId: document.id,
        recipients: [
          {
            name: user.name || '',
            email: user.email,
            role: 'SIGNER',
            signingOrder: 1,
            actionAuth: [],
          },
        ],
      });

      setIsSelfSignMode(true);
      setStep('fields');

      toast({
        title: _(msg`Self sign enabled`),
        description: _(msg`You can now place your signature fields.`),
      });
    } catch (err) {
      console.error(err);
      toast({
        title: _(msg`Error`),
        description: _(msg`Could not enable self sign.`),
        variant: 'destructive',
      });
    }
  };

  const onAddSettingsFormSubmit = async (data: TAddSettingsFormSchema) => {
    try {
      const { timezone, dateFormat, redirectUrl, language, signatureTypes } = data.meta;

      const parsedGlobalAccessAuth = z
        .array(ZDocumentAccessAuthTypesSchema)
        .safeParse(data.globalAccessAuth);

      await updateDocument({
        documentId: document.id,
        data: {
          title: data.title,
          externalId: data.externalId || null,
          visibility: data.visibility,
          globalAccessAuth: parsedGlobalAccessAuth.success ? parsedGlobalAccessAuth.data : [],
          globalActionAuth: data.globalActionAuth ?? [],
        },
        meta: {
          timezone,
          dateFormat,
          redirectUrl,
          language: isValidLanguageCode(language) ? language : undefined,
          typedSignatureEnabled: signatureTypes.includes(DocumentSignatureType.TYPE),
          uploadSignatureEnabled: signatureTypes.includes(DocumentSignatureType.UPLOAD),
          drawSignatureEnabled: signatureTypes.includes(DocumentSignatureType.DRAW),
        },
      });

      setStep('signers');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while updating the document settings.`),
        variant: 'destructive',
      });
    }
  };

  const onAddSignersFormSubmit = async (data: TAddSignersFormSchema) => {
    try {
      await Promise.all([
        setSigningOrderForDocument({
          documentId: document.id,
          signingOrder: data.signingOrder,
        }),

        updateDocument({
          documentId: document.id,
          meta: {
            allowDictateNextSigner: data.allowDictateNextSigner,
          },
        }),

        setRecipients({
          documentId: document.id,
          recipients: data.signers.map((signer) => ({
            ...signer,
            // Explicitly set to null to indicate we want to remove auth if required.
            actionAuth: signer.actionAuth ?? [],
          })),
        }),
      ]);

      setStep('fields');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding signers.`),
        variant: 'destructive',
      });
    }
  };

  const onAddFieldsFormSubmit = async (data: TAddFieldsFormSchema) => {
    try {
      await addFields({
        documentId: document.id,
        fields: data.fields,
      });

      // Clear all field data from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('field_')) {
          localStorage.removeItem(key);
        }
      }

      if (isSelfSignMode) {
        // Move document to PENDING without emails so signing mutations are allowed
        try {
          await sendDocument({
            documentId: document.id,
            sendEmail: false,
            suppressWebhooks: true,
          });
        } catch (e) {
          console.error('Failed to transition to PENDING for self-sign', e);
          // Continue anyway; the signing route will surface any issues
        }

        // Jump straight to signing view for the sole recipient (current user)
        // Use team-scoped documents path to ensure loader has a valid team context
        await navigate(`${documentRootPath}/${document.id}/sign`);
        return;
      }

      setStep('subject');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while adding the fields.`),
        variant: 'destructive',
      });
    }
  };

  const onAddSubjectFormSubmit = async (data: TAddSubjectFormSchema) => {
    const { subject, message, distributionMethod, emailId, emailReplyTo, emailSettings } =
      data.meta;

    try {
      await sendDocument({
        documentId: document.id,
        meta: {
          subject,
          message,
          distributionMethod,
          emailId,
          emailReplyTo: emailReplyTo || null,
          emailSettings: emailSettings,
        },
      });

      if (distributionMethod === DocumentDistributionMethod.EMAIL) {
        toast({
          title: _(msg`Document sent`),
          description: _(msg`Your document has been sent successfully.`),
          duration: 5000,
        });

        await navigate(documentRootPath);
      } else if (document.status === DocumentStatus.DRAFT) {
        toast({
          title: _(msg`Links Generated`),
          description: _(msg`Signing links have been generated for this document.`),
          duration: 5000,
        });
      } else {
        await navigate(`${documentRootPath}/${document.id}`);
      }
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while sending the document.`),
        variant: 'destructive',
      });
    }
  };

  const currentDocumentFlow = documentFlow[step];

  /**
   * Refresh the data in the background when steps change.
   */
  useEffect(() => {
    void refetchDocument();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className={cn('grid w-full grid-cols-12 gap-8', className)}>
      <Card
        className="relative col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7"
        gradient
      >
        <CardContent className="p-2">
          <PDFViewer
            key={document.documentData.id}
            documentData={document.documentData}
            document={document}
            onDocumentLoad={() => setIsDocumentPdfLoaded(true)}
          />
        </CardContent>
      </Card>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        {step === 'settings' && (
          <div className="mb-3 flex w-full items-center justify-end">
            <Button size="sm" variant="outline" onClick={() => void onSkipToFieldsSelfSign()}>
              {_(msg`Sign Document Myself`)}
            </Button>
          </div>
        )}
        <DocumentFlowFormContainer
          className="lg:h-[calc(100vh-6rem)]"
          onSubmit={(e) => e.preventDefault()}
        >
          <Stepper
            currentStep={currentDocumentFlow.stepIndex}
            setCurrentStep={(step) => setStep(EditDocumentSteps[step - 1])}
          >
            <AddSettingsFormPartial
              key={recipients.length}
              documentFlow={documentFlow.settings}
              document={document}
              currentTeamMemberRole={team.currentTeamRole}
              recipients={recipients}
              fields={fields}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              onSubmit={onAddSettingsFormSubmit}
            />

            <AddSignersFormPartial
              key={recipients.length}
              documentFlow={documentFlow.signers}
              recipients={recipients}
              signingOrder={document.documentMeta?.signingOrder}
              allowDictateNextSigner={document.documentMeta?.allowDictateNextSigner}
              fields={fields}
              onSubmit={onAddSignersFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />

            <AddFieldsFormPartial
              key={fields.length}
              documentFlow={documentFlow.fields}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddFieldsFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
              teamId={team.id}
            />

            <AddSubjectFormPartial
              key={recipients.length}
              documentFlow={documentFlow.subject}
              document={document}
              recipients={recipients}
              fields={fields}
              onSubmit={onAddSubjectFormSubmit}
              isDocumentPdfLoaded={isDocumentPdfLoaded}
            />
          </Stepper>
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
};
