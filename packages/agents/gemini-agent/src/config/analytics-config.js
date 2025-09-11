/**
 * Configuration for analytics service
 */
export const analyticsConfig = {
  metrics: {
    enabled: true,
    storageLimit: 1000,
    defaultPrecision: 2
  },
  reporting: {
    interval: 3600000, // 1 hour
    batchSize: 100,
    retentionDays: 30,
    exportFormat: 'json'
  },
  alerts: {
    enabled: true,
    thresholds: {
      error: 0.1,
      warning: 0.05
    }
  }
};
