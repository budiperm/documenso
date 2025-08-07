import { IS_DATA_RETENTION_ENABLED } from '../../../packages/lib/constants/auth';
import { startDataRetentionScheduler } from '../../../packages/lib/server-only/data-retention';

// Initialize data retention system if enabled
if (IS_DATA_RETENTION_ENABLED) {
  try {
    startDataRetentionScheduler();
    console.log('✅ Data retention scheduler started successfully');
  } catch (error) {
    console.error('❌ Failed to start data retention scheduler:', error);
  }
} else {
  console.log('ℹ️ Data retention feature is disabled');
}
