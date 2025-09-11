class MetricsService {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }

  incrementCounter(metric) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + 1);
  }

  recordTiming(metric, duration) {
    const timings = this.metrics.get(`${metric}_timings`) || [];
    timings.push(duration);
    this.metrics.set(`${metric}_timings`, timings);
  }

  getMetric(metric) {
    return this.metrics.get(metric);
  }

  getAllMetrics() {
    const result = {};
    for (const [key, value] of this.metrics.entries()) {
      result[key] = value;
    }
    return result;
  }

  reset() {
    this.metrics.clear();
    this.startTime = Date.now();
  }
}

export default MetricsService;
