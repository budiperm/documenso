import { DateTime } from 'luxon';

export interface DataRetentionInfo {
  isArchived: boolean;
  willBeDeleted: boolean;
  deletionDate?: DateTime;
  daysUntilDeletion?: number;
  warningLevel: 'none' | 'yellow' | 'red';
  backgroundColor: string;
}

/**
 * Calculate data retention information for a document
 */
export function getDataRetentionInfo(
  completedAt: Date | null,
  contentArchived: boolean,
  archivedAt: Date | null,
  retentionSchedule?: string,
): DataRetentionInfo {
  const defaultInfo: DataRetentionInfo = {
    isArchived: contentArchived,
    willBeDeleted: false,
    warningLevel: 'none',
    backgroundColor: 'bg-white dark:bg-gray-900',
  };

  if (!completedAt || !retentionSchedule) {
    return {
      ...defaultInfo,
      backgroundColor: contentArchived 
        ? 'bg-gray-50 dark:bg-gray-800' 
        : 'bg-white dark:bg-gray-900',
    };
  }

  // Parse retention schedule (e.g., "30d", "2h", "180m")
  const match = retentionSchedule.match(/^(\d+)([mhd])$/);
  if (!match) {
    return defaultInfo;
  }

  const [, amount, unit] = match;
  const retentionAmount = parseInt(amount, 10);
  
  let retentionDays: number;
  switch (unit) {
    case 'm':
      retentionDays = retentionAmount / (60 * 24); // minutes to days
      break;
    case 'h':
      retentionDays = retentionAmount / 24; // hours to days
      break;
    case 'd':
      retentionDays = retentionAmount;
      break;
    default:
      return defaultInfo;
  }

  const completedDate = DateTime.fromJSDate(completedAt);
  const deletionDate = completedDate.plus({ days: retentionDays });
  const now = DateTime.now();
  const daysUntilDeletion = deletionDate.diff(now, 'days').days;

  if (contentArchived) {
    return {
      isArchived: true,
      willBeDeleted: false,
      deletionDate,
      daysUntilDeletion: Math.max(0, daysUntilDeletion),
      warningLevel: 'none',
      backgroundColor: 'bg-gray-50 dark:bg-gray-800',
    };
  }

  // Document hasn't been archived yet, check if it's close to deletion
  const warningThreshold = retentionDays * 0.8; // 80% of retention period
  const urgentThreshold = retentionDays * 0.95; // 95% of retention period

  let warningLevel: 'none' | 'yellow' | 'red' = 'none';
  let backgroundColor = 'bg-white dark:bg-gray-900';

  if (daysUntilDeletion <= 0) {
    // Should be deleted (archived)
    warningLevel = 'red';
    backgroundColor = 'bg-red-50 dark:bg-red-900/20';
  } else if (daysUntilDeletion <= (retentionDays - urgentThreshold)) {
    // Very close to deletion (5% remaining)
    warningLevel = 'red';
    backgroundColor = 'bg-red-50 dark:bg-red-900/20';
  } else if (daysUntilDeletion <= (retentionDays - warningThreshold)) {
    // Getting close to deletion (20% remaining)
    warningLevel = 'yellow';
    backgroundColor = 'bg-yellow-50 dark:bg-yellow-900/20';
  }

  return {
    isArchived: false,
    willBeDeleted: true,
    deletionDate,
    daysUntilDeletion: Math.max(0, daysUntilDeletion),
    warningLevel,
    backgroundColor,
  };
}

/**
 * Get tooltip message for data retention warning
 */
export function getDataRetentionTooltip(info: DataRetentionInfo): string {
  if (info.isArchived) {
    return 'This document has been archived. The PDF content is no longer available, but metadata is preserved.';
  }

  if (!info.willBeDeleted) {
    return '';
  }

  if (info.daysUntilDeletion === undefined) {
    return '';
  }

  if (info.daysUntilDeletion <= 0) {
    return 'This document should have been archived. PDF content will be removed soon.';
  }

  const days = Math.ceil(info.daysUntilDeletion);
  
  if (info.warningLevel === 'red') {
    return `⚠️ This document will be archived in ${days} day${days === 1 ? '' : 's'}. PDF content will be removed but metadata will be preserved.`;
  }

  if (info.warningLevel === 'yellow') {
    return `📋 This document will be archived in ${days} day${days === 1 ? '' : 's'} according to the data retention policy.`;
  }

  return '';
}
