import { cleanupOldDocumentData } from './cleanup-documents';
import { IS_DATA_RETENTION_ENABLED, DATA_RETENTION_DAYS, DATA_RETENTION_SCHEDULE_INTERVAL_MS } from '../../constants/auth';
import { env } from '../../utils/env';

let cleanupInterval: any = null;

/**
 * Get human-readable schedule description
 */
function getScheduleDescription(): string {
  const ms = DATA_RETENTION_SCHEDULE_INTERVAL_MS;
  const minutes = ms / (60 * 1000);
  const hours = ms / (60 * 60 * 1000);
  const days = ms / (24 * 60 * 60 * 1000);
  
  if (days >= 1) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours >= 1) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/**
 * Start the scheduled data retention cleanup job
 */
export function startDataRetentionScheduler(): void {
  if (!IS_DATA_RETENTION_ENABLED) {
    console.log('Data retention scheduler not started (disabled in config)');
    return;
  }

  if (cleanupInterval) {
    console.log('Data retention scheduler already running');
    return;
  }

  console.log(`Starting data retention scheduler (runs every ${getScheduleDescription()}, retention: ${DATA_RETENTION_DAYS} days)`);

  // Run initial cleanup after 1 minute to avoid startup conflicts
  setTimeout(async () => {
    try {
      console.log('Running initial data retention cleanup...');
      await cleanupOldDocumentData();
    } catch (error) {
      console.error('Initial data retention cleanup failed:', error);
    }
  }, 60000);

  // Schedule recurring cleanup
  cleanupInterval = setInterval(async () => {
    try {
      console.log('Running scheduled data retention cleanup...');
      await cleanupOldDocumentData();
    } catch (error) {
      console.error('Scheduled data retention cleanup failed:', error);
    }
  }, DATA_RETENTION_SCHEDULE_INTERVAL_MS);

  // Cleanup on process termination
  const cleanup = () => {
    stopDataRetentionScheduler();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

/**
 * Stop the scheduled data retention cleanup job
 */
export function stopDataRetentionScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Data retention scheduler stopped');
  }
}

/**
 * Run cleanup manually (useful for testing or admin triggers)
 */
export async function runManualCleanup() {
  if (!IS_DATA_RETENTION_ENABLED) {
    throw new Error('Data retention is not enabled');
  }

  console.log('Running manual data retention cleanup...');
  return await cleanupOldDocumentData();
}

// Auto-initialize data retention scheduler in production
if (env('NODE_ENV') === 'production' && IS_DATA_RETENTION_ENABLED) {
  startDataRetentionScheduler();
}
