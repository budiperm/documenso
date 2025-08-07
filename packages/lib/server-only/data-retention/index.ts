/**
 * Data retention module initialization
 * Import this module to automatically start data retention scheduler in production
 */

// Import the scheduler to trigger auto-initialization
import './scheduler';

// Export functions for manual use
export { startDataRetentionScheduler, stopDataRetentionScheduler, runManualCleanup } from './scheduler';
export { cleanupOldDocumentData, getCleanupStats, getStorageStats } from './cleanup-documents';
