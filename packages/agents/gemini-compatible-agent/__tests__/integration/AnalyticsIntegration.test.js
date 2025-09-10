import { ProjectAnalyticsService } from '../../src/services/ProjectAnalyticsService.js';
import { AnalyticsHelper } from '../../src/utils/AnalyticsHelper.js';
import { analyticsConfig } from '../../src/config/analytics-config.js';

describe('Analytics Integration', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new ProjectAnalyticsService();
  });

  it('should integrate analytics service with helper utilities', () => {
    const values = [1, 2, 3, 4, 5];
    const average = AnalyticsHelper.calculateAverage(values);
    
    analyticsService.recordMetric('average', average);
    const formattedValue = AnalyticsHelper.formatMetricValue(
      analyticsService.getMetric('average'),
      analyticsConfig.metrics.defaultPrecision
    );

    expect(formattedValue).toBe('3.00');
  });
});
