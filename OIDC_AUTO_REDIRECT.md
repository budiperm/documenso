# OIDC Auto-Redirect Feature

This feature allows you to automatically redirect users to your OIDC provider instead of showing the default login form when OIDC is properly configured.

## Configuration

To enable automatic OIDC redirect, you need to:

1. Configure your OIDC provider settings in your `.env` file:
   ```bash
   NEXT_PRIVATE_OIDC_WELL_KNOWN="https://your-provider.com/.well-known/openid-configuration"
   NEXT_PRIVATE_OIDC_CLIENT_ID="your-client-id"
   NEXT_PRIVATE_OIDC_CLIENT_SECRET="your-client-secret"
   NEXT_PRIVATE_OIDC_PROVIDER_LABEL="Your Provider Name"
   ```

2. Enable auto-redirect by setting:
   ```bash
   NEXT_PRIVATE_OIDC_AUTO_REDIRECT="true"
   ```

## How it works

When a user visits the `/signin` page:

1. **If OIDC auto-redirect is enabled**: The user is automatically redirected to the OIDC provider for authentication
2. **If there's an error or the user explicitly wants to see the form**: The traditional login form is shown instead

## Bypassing auto-redirect

Users can bypass the auto-redirect and see the traditional login form by:

1. Adding `?show_form=true` to the signin URL: `/signin?show_form=true`
2. Adding `?force_form=true` to the signin URL: `/signin?force_form=true`

This is useful for:
- Administrative access when OIDC is down
- Users who prefer username/password authentication
- Debugging authentication issues

## Error handling

If the OIDC provider returns an error or the user cancels the authentication:
- The user is redirected back to the signin page
- The traditional login form is automatically displayed
- Error parameters in the URL prevent infinite redirect loops

## Security considerations

- Auto-redirect only occurs when all required OIDC environment variables are properly configured
- Users can always access the traditional login form if needed
- Error states are properly handled to prevent authentication loops
- The feature respects existing `returnTo` parameters for post-login redirection

## Implementation details

The feature is implemented in:
- `packages/lib/constants/auth.ts` - Environment variable validation
- `apps/remix/app/routes/_unauthenticated+/signin.tsx` - Server-side logic
- `apps/remix/app/components/forms/signin.tsx` - Client-side auto-redirect logic

The auto-redirect is triggered client-side to ensure proper handling of the OAuth flow and maintain compatibility with the existing authentication system.
