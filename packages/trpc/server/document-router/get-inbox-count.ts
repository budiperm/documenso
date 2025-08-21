import { DocumentStatus, RecipientRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetInboxCountRequestSchema, ZGetInboxCountResponseSchema } from './get-inbox-count.types';

export const getInboxCountRoute = authenticatedProcedure
  .input(ZGetInboxCountRequestSchema)
  .output(ZGetInboxCountResponseSchema)
  .query(async ({ input, ctx }) => {
    const { readStatus } = input ?? {};

    const userEmail = ctx.user.email;
  const userId = ctx.user.id;

    // Exclude pure self-sign documents from the inbox count. A pure self-sign document is:
    // - Owned by the current user, AND
    // - Every recipient is either the current user or CC, AND
    // - There is at least one non-CC recipient that is the current user.
    // This avoids increasing the badge for immediate self-sign flows while preserving normal counts.
    const count = await prisma.recipient.count({
      where: {
        email: userEmail,
        readStatus,
        role: {
          not: RecipientRole.CC,
        },
        document: {
          status: {
            not: DocumentStatus.DRAFT,
          },
          deletedAt: null,
          NOT: {
            AND: [
              { userId },
              {
                recipients: {
                  every: {
                    OR: [
                      { role: RecipientRole.CC },
                      { email: userEmail },
                    ],
                  },
                },
              },
              {
                recipients: {
                  some: {
                    role: { not: RecipientRole.CC },
                    email: userEmail,
                  },
                },
              },
            ],
          },
        },
      },
    });

    return {
      count,
    };
  });
