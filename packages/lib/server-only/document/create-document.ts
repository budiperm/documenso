import {
  DocumentSource,
  type DocumentVisibility,
  FieldType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { normalizePdf as makeNormalizedPdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { prefixedId, nanoid } from '../../universal/id';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { extractDerivedDocumentMeta } from '../../utils/document';
import { determineDocumentVisibility } from '../../utils/document-visibility';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';
import { getTeamSettings } from '../team/get-team-settings';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  title: string;
  externalId?: string | null;
  userId: number;
  teamId: number;
  documentDataId: string;
  formValues?: Record<string, string | number | boolean>;
  normalizePdf?: boolean;
  timezone?: string;
  userTimezone?: string;
  requestMetadata: ApiRequestMetadata;
  folderId?: string;
  selfSign?: boolean;
};

export const createDocument = async ({
  userId,
  title,
  externalId,
  documentDataId,
  teamId,
  normalizePdf,
  formValues,
  requestMetadata,
  timezone,
  userTimezone,
  folderId,
  selfSign = false,
}: CreateDocumentOptions) => {
  const team = await getTeamById({ userId, teamId });

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  let folderVisibility: DocumentVisibility | undefined;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
      },
      select: {
        visibility: true,
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }

    folderVisibility = folder.visibility;
  }

  if (normalizePdf) {
    const documentData = await prisma.documentData.findFirst({
      where: {
        id: documentDataId,
      },
    });

    if (documentData) {
      const buffer = await getFileServerSide(documentData);

  const normalizedPdf = await makeNormalizedPdf(Buffer.from(buffer));

      const newDocumentData = await putPdfFileServerSide({
        name: title.endsWith('.pdf') ? title : `${title}.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () =>
          Promise.resolve(
            normalizedPdf.buffer.slice(
              normalizedPdf.byteOffset,
              normalizedPdf.byteOffset + normalizedPdf.byteLength,
            ) as ArrayBuffer,
          ),
      });

      // eslint-disable-next-line require-atomic-updates
      documentDataId = newDocumentData.id;
    }
  }

  // userTimezone is last because it's always passed in regardless of the organisation/team settings
  // for uploads from the frontend
  const timezoneToUse = timezone || settings.documentTimezone || userTimezone;

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        qrToken: prefixedId('qr'),
        externalId,
        documentDataId,
        userId,
        teamId,
        folderId,
        visibility:
          folderVisibility ??
          determineDocumentVisibility(settings.documentVisibility, team.currentTeamRole),
        formValues,
        source: DocumentSource.DOCUMENT,
        documentMeta: {
          create: extractDerivedDocumentMeta(settings, {
            timezone: timezoneToUse,
          }),
        },
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        metadata: requestMetadata,
        data: {
          title,
          source: {
            type: DocumentSource.DOCUMENT,
          },
        },
      }),
    });

    // If self-signing, create a recipient for the current user
  if (selfSign) {
      const user = await tx.user.findUnique({
        where: { id: userId },
    select: { name: true, email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

  const createdRecipient = await tx.recipient.create({
        data: {
          documentId: document.id,
          name: user.name || '',
          email: user.email,
          role: RecipientRole.SIGNER,
          signingOrder: 1,
          token: nanoid(),
          sendStatus: SendStatus.NOT_SENT, // No email needed for self-signing
          signingStatus: SigningStatus.NOT_SIGNED,
          authOptions: {
            accessAuth: ['ACCOUNT'],
    actionAuth: ['ACCOUNT'],
          },
        },
      });

      // Add a default signature field for self-signing
    await tx.field.create({
        data: {
          documentId: document.id,
          recipientId: createdRecipient.id,
          type: FieldType.SIGNATURE,
      page: 1,
      positionX: 100,
      positionY: 100,
      width: 200,
      height: 60,
          customText: '',
          inserted: false,
        },
      });

  await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED,
          documentId: document.id,
          metadata: requestMetadata,
          data: {
            recipientId: createdRecipient.id,
            recipientName: user.name || '',
            recipientEmail: user.email,
    recipientRole: RecipientRole.SIGNER,
    accessAuth: ['ACCOUNT'],
    actionAuth: ['ACCOUNT'],
          },
        }),
      });
    }

    const createdDocument = await tx.document.findFirst({
      where: {
        id: document.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    if (!createdDocument) {
      throw new Error('Document not found');
    }

  await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
      userId,
      teamId,
    });

    return createdDocument;
  });
};
