import { env } from '../utils/env';
import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const SALT_ROUNDS = 12;

import { APP_NAME } from './app';

export const PROVIDER_MAP = {
  DOCUMENSO: APP_NAME(),
} as const;

export const IS_GOOGLE_SSO_ENABLED = Boolean(
  env('NEXT_PRIVATE_GOOGLE_CLIENT_ID') && env('NEXT_PRIVATE_GOOGLE_CLIENT_SECRET'),
);

export const IS_OIDC_SSO_ENABLED = Boolean(
  env('NEXT_PRIVATE_OIDC_WELL_KNOWN') &&
    env('NEXT_PRIVATE_OIDC_CLIENT_ID') &&
    env('NEXT_PRIVATE_OIDC_CLIENT_SECRET'),
);

export const OIDC_PROVIDER_LABEL = env('NEXT_PRIVATE_OIDC_PROVIDER_LABEL');

export const OIDC_PROVIDER = IS_OIDC_SSO_ENABLED
  ? {
      clientId: env('NEXT_PRIVATE_OIDC_CLIENT_ID')!,
      clientSecret: env('NEXT_PRIVATE_OIDC_CLIENT_SECRET')!,
      wellKnown: env('NEXT_PRIVATE_OIDC_WELL_KNOWN')!,
      skipVerify: env('NEXT_PRIVATE_OIDC_SKIP_VERIFY') === 'true',
      label: OIDC_PROVIDER_LABEL || 'OIDC',
    }
  : null;

export const IS_OIDC_AUTO_REDIRECT_ENABLED =
  env('NEXT_PRIVATE_OIDC_AUTO_REDIRECT') === 'true' &&
  !!OIDC_PROVIDER?.clientId &&
  !!OIDC_PROVIDER?.clientSecret &&
  !!OIDC_PROVIDER?.wellKnown;

/**
 * Data retention configuration
 */
export const IS_DATA_RETENTION_ENABLED = Boolean(
  env('NEXT_PRIVATE_DATA_RETENTION_ENABLED') === 'true',
);

export const DATA_RETENTION_DAYS = Number(env('NEXT_PRIVATE_DATA_RETENTION_DAYS')) || 90;

export const DATA_RETENTION_COMPLETED_ONLY = Boolean(
  env('NEXT_PRIVATE_DATA_RETENTION_COMPLETED_ONLY') !== 'false',
);

/**
 * Parse scheduler interval from environment variable
 * Format: "number unit" where unit can be 'm', 'h', 'd' (minutes, hours, days)
 * Examples: "30m", "2h", "1d"
 * Default: "24h" (24 hours)
 */
function parseSchedulerInterval(): number {
  const intervalStr = env('NEXT_PRIVATE_DATA_RETENTION_SCHEDULE') || '24h';
  const match = intervalStr.match(/^(\d+)([mhd])$/i);
  
  if (!match) {
    console.warn(`Invalid scheduler interval format: ${intervalStr}. Using default 24h.`);
    return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'm': // minutes
      return value * 60 * 1000;
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'd': // days
      return value * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export const DATA_RETENTION_SCHEDULE_INTERVAL_MS = parseSchedulerInterval();

/**
 * Get human-readable data retention schedule from environment variable
 * Examples: "30 minutes", "2 hours", "1 day", "30 days"
 */
export function getDataRetentionSchedule(): string {
  const intervalStr = env('NEXT_PRIVATE_DATA_RETENTION_SCHEDULE') || '24h';
  const match = intervalStr.match(/^(\d+)([mhd])$/i);
  
  if (!match) {
    return '24 hours';
  }
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'm':
      return value === 1 ? '1 minute' : `${value} minutes`;
    case 'h':
      return value === 1 ? '1 hour' : `${value} hours`;
    case 'd':
      return value === 1 ? '1 day' : `${value} days`;
    default:
      return '24 hours';
  }
}

/**
 * Get human-readable data retention time (how long documents are kept)
 * Examples: "30 days", "1 day", "90 days"
 */
export function getDataRetentionTime(): string {
  const days = DATA_RETENTION_DAYS;
  
  // Debug: log the actual value being used
  console.log('DATA_RETENTION_DAYS value:', days);
  console.log('Environment check:', env('NEXT_PRIVATE_DATA_RETENTION_DAYS'));
  
  if (days === 1) {
    return '1 day';
  }
  
  return `${days} days`;
}

export const USER_SECURITY_AUDIT_LOG_MAP: Record<string, string> = {
  ACCOUNT_SSO_LINK: 'Linked account to SSO',
  ACCOUNT_PROFILE_UPDATE: 'Profile updated',
  AUTH_2FA_DISABLE: '2FA Disabled',
  AUTH_2FA_ENABLE: '2FA Enabled',
  PASSKEY_CREATED: 'Passkey created',
  PASSKEY_DELETED: 'Passkey deleted',
  PASSKEY_UPDATED: 'Passkey updated',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_UPDATE: 'Password updated',
  SESSION_REVOKED: 'Session revoked',
  SIGN_OUT: 'Signed Out',
  SIGN_IN: 'Signed In',
  SIGN_IN_FAIL: 'Sign in attempt failed',
  SIGN_IN_PASSKEY_FAIL: 'Passkey sign in failed',
  SIGN_IN_2FA_FAIL: 'Sign in 2FA attempt failed',
};

/**
 * The duration to wait for a passkey to be verified in MS.
 */
export const PASSKEY_TIMEOUT = 60000;

/**
 * The maximum number of passkeys are user can have.
 */
export const MAXIMUM_PASSKEYS = 50;

export const useSecureCookies =
  env('NODE_ENV') === 'production' && String(NEXT_PUBLIC_WEBAPP_URL()).startsWith('https://');

const secureCookiePrefix = useSecureCookies ? '__Secure-' : '';

export const formatSecureCookieName = (name: string) => `${secureCookiePrefix}${name}`;

export const getCookieDomain = () => {
  const url = new URL(NEXT_PUBLIC_WEBAPP_URL());

  return url.hostname;
};
