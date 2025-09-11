import MetricsService from '../../src/services/MetricsService';

describe('MetricsService', () => {
  let metricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  test('should increment counter', () => {
    metricsService.incrementCounter('test_metric');
    expect(metricsService.getMetric('test_metric')).toBe(1);
    
    metricsService.incrementCounter('test_metric');
    expect(metricsService.getMetric('test_metric')).toBe(2);
  });

  test('should record timing', () => {
    metricsService.recordTiming('api_call', 100);
    const timings = metricsService.getMetric('api_call_timings');
    expect(timings).toEqual([100]);
  });

  test('should reset metrics', () => {
    metricsService.incrementCounter('test_metric');
    metricsService.reset();
    expect(metricsService.getMetric('test_metric')).toBeUndefined();
  });
});
