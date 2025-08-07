import { useEffect, useMemo, useState } from 'react';
import { type LoaderFunctionArgs } from 'react-router';

import { Trans } from '@lingui/react/macro';
import { FolderType, OrganisationType } from '@prisma/client';
import { useLoaderData, useParams, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DATA_RETENTION_DAYS } from '@documenso/lib/constants/auth';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { trpc } from '@documenso/trpc/react';
import {
  type TFindDocumentsInternalResponse,
  ZFindDocumentsInternalRequestSchema,
} from '@documenso/trpc/server/document-router/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { DocumentMoveToFolderDialog } from '~/components/dialogs/document-move-to-folder-dialog';
import { DocumentDropZoneWrapper } from '~/components/general/document/document-drop-zone-wrapper';
import { DocumentSearch } from '~/components/general/document/document-search';
import { DocumentStatus } from '~/components/general/document/document-status';
import { FolderGrid } from '~/components/general/folder/folder-grid';
import { PeriodSelector } from '~/components/general/period-selector';
import { DocumentsTable } from '~/components/tables/documents-table';
import { DocumentsTableEmptyState } from '~/components/tables/documents-table-empty-state';
import { DocumentsTableSenderFilter } from '~/components/tables/documents-table-sender-filter';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Documents');
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Pass server-side environment data to client
  return {
    dataRetentionDays: DATA_RETENTION_DAYS,
  };
}

const ZSearchParamsSchema = ZFindDocumentsInternalRequestSchema.pick({
  status: true,
  period: true,
  page: true,
  perPage: true,
  query: true,
}).extend({
  senderIds: z.string().transform(parseToIntegerArray).optional().catch([]),
});

export default function DocumentsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();
  
  // Get retention time for display from server data
  const retentionDays = loaderData.dataRetentionDays;
  const retentionTime = retentionDays === 1 ? '1 day' : `${retentionDays} days`;

  const { folderId } = useParams();
  const [searchParams] = useSearchParams();

  const [isMovingDocument, setIsMovingDocument] = useState(false);
  const [documentToMove, setDocumentToMove] = useState<number | null>(null);

  const [stats, setStats] = useState<TFindDocumentsInternalResponse['stats']>({
    [ExtendedDocumentStatus.DRAFT]: 0,
    [ExtendedDocumentStatus.PENDING]: 0,
    [ExtendedDocumentStatus.COMPLETED]: 0,
    [ExtendedDocumentStatus.REJECTED]: 0,
    [ExtendedDocumentStatus.INBOX]: 0,
    [ExtendedDocumentStatus.ALL]: 0,
  });

  const findDocumentSearchParams = useMemo(
    () => ZSearchParamsSchema.safeParse(Object.fromEntries(searchParams.entries())).data || {},
    [searchParams],
  );

  const { data, isLoading, isLoadingError } = trpc.document.findDocumentsInternal.useQuery({
    ...findDocumentSearchParams,
    folderId,
  });

  const getTabHref = (value: keyof typeof ExtendedDocumentStatus) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (value === ExtendedDocumentStatus.ALL) {
      params.delete('status');
    }

    if (value === ExtendedDocumentStatus.INBOX && organisation.type === OrganisationType.PERSONAL) {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    let path = formatDocumentsPath(team.url);

    if (folderId) {
      path += `/f/${folderId}`;
    }

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    return path;
  };

  useEffect(() => {
    if (data?.stats) {
      setStats(data.stats);
    }
  }, [data?.stats]);

  return (
    <DocumentDropZoneWrapper>
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
        <FolderGrid type={FolderType.DOCUMENT} parentId={folderId ?? null} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
          <div className="flex flex-row items-center">
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
              <AvatarFallback className="text-muted-foreground text-xs">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <h2 className="text-4xl font-semibold">
              <Trans>Documents</Trans>
            </h2>
          </div>

          <div className="-m-1 flex flex-wrap gap-x-4 gap-y-6 overflow-hidden p-1">
            <Tabs value={findDocumentSearchParams.status || 'ALL'} className="overflow-x-auto">
              <TabsList>
                {[
                  ExtendedDocumentStatus.INBOX,
                  ExtendedDocumentStatus.PENDING,
                  ExtendedDocumentStatus.COMPLETED,
                  ExtendedDocumentStatus.DRAFT,
                  ExtendedDocumentStatus.ALL,
                ]
                  .filter((value) => {
                    if (organisation.type === OrganisationType.PERSONAL) {
                      return value !== ExtendedDocumentStatus.INBOX;
                    }

                    return true;
                  })
                  .map((value) => (
                    <TabsTrigger
                      key={value}
                      className="hover:text-foreground min-w-[60px]"
                      value={value}
                      asChild
                    >
                      <Link to={getTabHref(value)} preventScrollReset>
                        <DocumentStatus status={value} />

                        {value !== ExtendedDocumentStatus.ALL && (
                          <span className="ml-1 inline-block opacity-50">{stats[value]}</span>
                        )}
                      </Link>
                    </TabsTrigger>
                  ))}
              </TabsList>
            </Tabs>

            {team && <DocumentsTableSenderFilter teamId={team.id} />}

            <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
              <PeriodSelector />
            </div>
            <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
              <DocumentSearch initialValue={findDocumentSearchParams.query} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div>
            {data && data.count === 0 ? (
              <DocumentsTableEmptyState
                status={findDocumentSearchParams.status || ExtendedDocumentStatus.ALL}
              />
            ) : (
              <DocumentsTable
                data={data}
                isLoading={isLoading}
                isLoadingError={isLoadingError}
                onMoveDocument={(documentId) => {
                  setDocumentToMove(documentId);
                  setIsMovingDocument(true);
                }}
              />
            )}
          </div>
          
          {/* Data Retention Information */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  <Trans>Data Retention Policy Active</Trans>
                </h4>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  <Trans>
                    Document content is automatically deleted in {retentionTime}. Document metadata, signatures, and audit logs are preserved.
                  </Trans>
                </p>
              </div>
            </div>
          </div>
        </div>

        {documentToMove && (
          <DocumentMoveToFolderDialog
            documentId={documentToMove}
            open={isMovingDocument}
            currentFolderId={folderId}
            onOpenChange={(open) => {
              setIsMovingDocument(open);

              if (!open) {
                setDocumentToMove(null);
              }
            }}
          />
        )}
      </div>
    </DocumentDropZoneWrapper>
  );
}
