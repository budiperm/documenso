import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PRIVATE_RESTRICT_ORGANISATION_CREATION_TO_ADMIN } from '@documenso/lib/constants/app';

import { OrganisationCreateDialog } from '~/components/dialogs/organisation-create-dialog';
import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { SettingsHeader } from '~/components/general/settings-header';
import { UserOrganisationsTable } from '~/components/tables/user-organisations-table';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();
  const { user } = useSession();

  const canCreateOrganisation = !NEXT_PRIVATE_RESTRICT_ORGANISATION_CREATION_TO_ADMIN() || 
    (user?.roles && user.roles.includes('ADMIN'));

  const handleUnauthorizedClick = () => {
    alert('Unauthorized: You do not have permission to create organisations.');
  };

  return (
    <div>
      <SettingsHeader
        title={_(msg`Organisations`)}
        subtitle={_(msg`Manage all organisations you are currently associated with.`)}
      >
        {canCreateOrganisation ? (
          <OrganisationCreateDialog />
        ) : (
          <button
            onClick={handleUnauthorizedClick}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Create organisation
          </button>
        )}
      </SettingsHeader>

      <UserOrganisationsTable />

      <div className="mt-8 space-y-8">
        <OrganisationInvitations />
      </div>
    </div>
  );
}
