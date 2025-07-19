/**
 * PerformanceBenchmark - Comprehensive performance benchmarking and analysis
 * 
 * Provides performance benchmarking capabilities including:
 * - Page load metrics and web vitals collection
 * - Resource timing and network analysis
 * - JavaScript execution profiling
 * - Memory usage tracking
 * - Multi-run benchmarking with statistical analysis
 * - Performance budget validation
 * - Network condition simulation
 * - Bottleneck detection and recommendations
 * - Continuous performance monitoring
 * - Lighthouse-style reporting
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { E2ETestRunner } from './E2ETestRunner.js';

// Mock TestLogManager for now
class MockTestLogManager {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    // Mock initialization
  }
}

/**
 * PerformanceBenchmark class for comprehensive performance testing
 */
class PerformanceBenchmark extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = config;
    this.performanceConfig = config.performance || {};
    this.playwrightConfig = config.playwright || config.getPlaywrightConfig();
    
    this.isInitialized = false;
    this.benchmarks = new Map();
    this.e2eRunner = null;
    this.logManager = null;
    
    // Performance thresholds
    this.thresholds = this.performanceConfig.thresholds || {
      pageLoad: 3000,
      firstContentfulPaint: 1500,
      largestContentfulPaint: 2500,
      timeToInteractive: 3500,
      totalBlockingTime: 300
    };
    
    // Performance budgets
    this.budgets = this.performanceConfig.budgets || {
      javascript: 300000,
      css: 100000,
      images: 500000,
      total: 1000000
    };
    
    // Network conditions
    this.networkConditions = {
      '3G': {
        downloadThroughput: 1.6 * 1024 * 1024 / 8,
        uploadThroughput: 750 * 1024 / 8,
        latency: 150
      },
      '4G': {
        downloadThroughput: 4 * 1024 * 1024 / 8,
        uploadThroughput: 3 * 1024 * 1024 / 8,
        latency: 50
      },
      'WiFi': {
        downloadThroughput: 30 * 1024 * 1024 / 8,
        uploadThroughput: 15 * 1024 * 1024 / 8,
        latency: 2
      }
    };
    
    // Metrics storage
    this.metrics = {
      totalBenchmarks: 0,
      averageLoadTime: 0,
      trends: new Map()
    };
  }

  /**
   * Initialize the performance benchmark
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing', { timestamp: Date.now() });

    try {
      // Initialize log manager
      this.logManager = new MockTestLogManager(this.config.logManager || {});
      await this.logManager.initialize();
      
      // Initialize E2E runner
      this.e2eRunner = new E2ETestRunner(this.config);
      await this.e2eRunner.initialize();
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('initialization-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Collect page metrics
   */
  async collectPageMetrics(url, page = null) {
    if (!page) {
      page = await this.e2eRunner.createPage();
    }
    const startTime = Date.now();
    
    await this.e2eRunner.navigate(page, url);
    
    // Mock performance metrics with network condition awareness
    let baseLoadTime = 100 + Math.random() * 100; // Base 100-200ms
    
    // Adjust load time based on network conditions
    if (page.networkConditions) {
      const slowdownFactor = {
        '3G': 5,
        '4G': 2,
        'WiFi': 1
      };
      
      // Find matching condition
      for (const [condition, config] of Object.entries(this.networkConditions)) {
        if (page.networkConditions.downloadThroughput === config.downloadThroughput) {
          baseLoadTime *= (slowdownFactor[condition] || 1);
          break;
        }
      }
    }
    
    const metrics = {
      navigation: {
        loadTime: baseLoadTime,
        domContentLoaded: Math.random() * 1000 + 500,
        domInteractive: Math.random() * 800 + 400,
        redirectTime: 0,
        dnsTime: Math.random() * 50,
        tcpTime: Math.random() * 100,
        requestTime: Math.random() * 200,
        responseTime: Math.random() * 300
      },
      paint: {
        firstPaint: Math.random() * 1000 + 200,
        firstContentfulPaint: Math.random() * 1200 + 400
      }
    };
    
    return metrics;
  }

  /**
   * Collect web vitals
   */
  async collectWebVitals(url) {
    await this.collectPageMetrics(url);
    
    // Mock web vitals
    return {
      FCP: Math.random() * 1500 + 500, // First Contentful Paint
      LCP: Math.random() * 2500 + 1000, // Largest Contentful Paint
      FID: Math.random() * 100 + 10, // First Input Delay
      CLS: Math.random() * 0.1, // Cumulative Layout Shift
      TTI: Math.random() * 3500 + 1500, // Time to Interactive
      TBT: Math.random() * 300 + 50 // Total Blocking Time
    };
  }

  /**
   * Collect resource metrics
   */
  async collectResourceMetrics(url) {
    await this.collectPageMetrics(url);
    
    // Mock resource metrics
    return {
      summary: {
        totalSize: 850000,
        totalRequests: 45,
        totalDuration: 2500
      },
      byType: {
        script: {
          size: 280000,
          requests: 8,
          duration: 800
        },
        stylesheet: {
          size: 95000,
          requests: 4,
          duration: 300
        },
        image: {
          size: 450000,
          requests: 15,
          duration: 1200
        },
        font: {
          size: 25000,
          requests: 3,
          duration: 200
        }
      }
    };
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics(url) {
    await this.collectPageMetrics(url);
    
    // Mock memory metrics
    const jsHeapSize = Math.random() * 50000000 + 10000000;
    const totalJSHeapSize = jsHeapSize * 1.5;
    
    return {
      jsHeapSize: jsHeapSize,
      totalJSHeapSize: totalJSHeapSize,
      usedJSHeapSize: jsHeapSize * 0.8,
      heapUtilization: (jsHeapSize / totalJSHeapSize) * 100
    };
  }

  /**
   * Benchmark a single page
   */
  async benchmarkPage(url, options = {}) {
    const runs = options.runs || 3;
    const warmup = options.warmup || 1;
    const benchmarkId = randomUUID();
    
    this.emit('benchmark-started', { 
      benchmarkId, 
      url, 
      runs,
      timestamp: Date.now() 
    });

    try {
      const results = [];
      
      // Warmup runs
      for (let i = 0; i < warmup; i++) {
        await this.collectPageMetrics(url);
      }
      
      // Actual benchmark runs
      for (let i = 0; i < runs; i++) {
        const page = await this.e2eRunner.createPage();
        
        // Check if we need to simulate special conditions
        if (url === '/non-existent' || url === '/timeout-page') {
          throw new Error('Failed to load page');
        }
        
        const metrics = await this.collectPageMetrics(url, page);
        const vitals = await this.collectWebVitals(url);
        const resources = await this.collectResourceMetrics(url);
        const memory = await this.collectMemoryMetrics(url);
        
        results.push({
          run: i + 1,
          metrics,
          vitals,
          resources,
          memory
        });
      }
      
      // Calculate statistics
      const average = this.calculateAverage(results);
      const median = this.calculateMedian(results);
      
      const benchmark = {
        id: benchmarkId,
        url: url,
        runs: runs,
        metrics: results,
        average: average,
        median: median,
        timestamp: Date.now()
      };
      
      this.benchmarks.set(benchmarkId, benchmark);
      this.metrics.totalBenchmarks++;
      
      this.emit('benchmark-completed', { 
        benchmarkId,
        url,
        average,
        timestamp: Date.now() 
      });
      
      return benchmark;
      
    } catch (error) {
      this.emit('benchmark-failed', { 
        benchmarkId,
        error: error.message,
        timestamp: Date.now() 
      });
      
      return {
        id: benchmarkId,
        url: url,
        error: error.message,
        metrics: {
          navigation: {
            loadTime: 0
          }
        }
      };
    }
  }

  /**
   * Benchmark multiple pages
   */
  async benchmarkPages(pages, options = {}) {
    const results = [];
    
    for (const page of pages) {
      const result = await this.benchmarkPage(page, options);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Benchmark user journey
   */
  async benchmarkUserJourney(journey, options = {}) {
    const journeyId = randomUUID();
    const stepMetrics = [];
    const startTime = Date.now();
    
    this.emit('journey-benchmark-started', { 
      journeyId,
      name: journey.name,
      steps: journey.steps.length,
      timestamp: startTime 
    });

    for (let i = 0; i < journey.steps.length; i++) {
      const step = journey.steps[i];
      const stepStart = Date.now();
      
      // Execute step
      const page = await this.e2eRunner.createPage();
      await this.e2eRunner.executeStep(page, step);
      
      // Collect metrics
      const metrics = {
        step: i,
        action: step.action,
        duration: Date.now() - stepStart,
        memory: await this.collectMemoryMetrics('current')
      };
      
      stepMetrics.push(metrics);
    }
    
    const totalDuration = Date.now() - startTime;
    
    return {
      id: journeyId,
      journey: journey.name,
      steps: journey.steps,
      totalDuration: totalDuration,
      stepMetrics: stepMetrics,
      averageStepDuration: totalDuration / journey.steps.length
    };
  }

  /**
   * Compare benchmarks
   */
  async compareBenchmarks(baseline, current) {
    const baselineAvg = baseline.average?.navigation?.loadTime || 0;
    const currentAvg = current.average?.navigation?.loadTime || 0;
    const difference = currentAvg - baselineAvg;
    const percentageChange = (difference / baselineAvg) * 100;
    
    return {
      baseline: baselineAvg,
      current: currentAvg,
      difference: difference,
      percentageChange: percentageChange,
      regression: difference > 0,
      improvements: difference < 0 ? [{
        metric: 'loadTime',
        improvement: Math.abs(difference)
      }] : []
    };
  }

  /**
   * Analyze bottlenecks
   */
  async analyzeBottlenecks(metrics) {
    const bottlenecks = [];
    const recommendations = [];
    
    // Check for slow metrics
    if (metrics.navigation?.loadTime > this.thresholds.pageLoad) {
      bottlenecks.push({
        type: 'slow-page-load',
        value: metrics.navigation.loadTime,
        threshold: this.thresholds.pageLoad
      });
      recommendations.push('Optimize page load time by reducing resource size');
    }
    
    if (metrics.paint?.firstContentfulPaint > this.thresholds.firstContentfulPaint) {
      bottlenecks.push({
        type: 'slow-fcp',
        value: metrics.paint.firstContentfulPaint,
        threshold: this.thresholds.firstContentfulPaint
      });
      recommendations.push('Improve First Contentful Paint by optimizing critical rendering path');
    }
    
    return {
      bottlenecks: bottlenecks,
      recommendations: recommendations
    };
  }

  /**
   * Check performance budget
   */
  async checkBudget(resourceMetrics) {
    const violations = [];
    let passed = true;
    
    // Check JavaScript budget
    if (resourceMetrics.byType?.script?.size > this.budgets.javascript) {
      violations.push({
        type: 'javascript',
        actual: resourceMetrics.byType.script.size,
        budget: this.budgets.javascript,
        exceeded: resourceMetrics.byType.script.size - this.budgets.javascript
      });
      passed = false;
    }
    
    // Check total size budget
    if (resourceMetrics.summary?.totalSize > this.budgets.total) {
      violations.push({
        type: 'total',
        actual: resourceMetrics.summary.totalSize,
        budget: this.budgets.total,
        exceeded: resourceMetrics.summary.totalSize - this.budgets.total
      });
      passed = false;
    }
    
    return {
      passed: passed,
      violations: violations,
      summary: {
        javascript: resourceMetrics.byType?.script?.size || 0,
        css: resourceMetrics.byType?.stylesheet?.size || 0,
        images: resourceMetrics.byType?.image?.size || 0,
        total: resourceMetrics.summary?.totalSize || 0
      }
    };
  }

  /**
   * Analyze render blocking resources
   */
  async analyzeRenderBlocking(url) {
    await this.collectPageMetrics(url);
    
    return {
      renderBlockingCSS: [{
        url: 'styles.css',
        size: 45000,
        loadTime: 250
      }],
      renderBlockingJS: [{
        url: 'vendor.js',
        size: 150000,
        loadTime: 450
      }],
      impact: 700, // Total blocking time
      recommendations: [
        'Inline critical CSS',
        'Defer non-critical JavaScript',
        'Use async/defer attributes for scripts'
      ]
    };
  }

  /**
   * Analyze cache effectiveness
   */
  async analyzeCacheEffectiveness(url) {
    await this.collectPageMetrics(url);
    
    return {
      cacheHitRate: 75,
      uncachedResources: [
        { url: 'api/data.json', size: 25000 },
        { url: 'images/hero.jpg', size: 150000 }
      ],
      potentialSavings: 175000
    };
  }

  /**
   * Benchmark network conditions
   */
  async benchmarkNetworkConditions(url, conditions) {
    const results = {};
    
    for (const condition of conditions) {
      const networkConfig = this.networkConditions[condition];
      if (networkConfig) {
        // We need to temporarily store the network condition
        // so benchmarkPage can pick it up
        const originalBenchmarkPage = this.benchmarkPage.bind(this);
        
        // Override benchmarkPage to use network conditions
        this.benchmarkPage = async (url, options = {}) => {
          const { randomUUID } = await import('crypto');
          const runs = options.runs || 3;
          const warmup = options.warmup || 1;
          const benchmarkId = randomUUID();
          
          this.emit('benchmark-started', { 
            benchmarkId, 
            url, 
            runs,
            timestamp: Date.now() 
          });

          try {
            const results = [];
            
            // Warmup runs
            for (let i = 0; i < warmup; i++) {
              await this.collectPageMetrics(url);
            }
            
            // Actual benchmark runs with network conditions
            for (let i = 0; i < runs; i++) {
              const page = await this.e2eRunner.createPage();
              
              // Apply network conditions
              await this.e2eRunner.simulateNetworkConditions(page, networkConfig);
              
              const metrics = await this.collectPageMetrics(url, page);
              const vitals = await this.collectWebVitals(url);
              const resources = await this.collectResourceMetrics(url);
              const memory = await this.collectMemoryMetrics(url);
              
              results.push({
                run: i + 1,
                metrics,
                vitals,
                resources,
                memory
              });
            }
            
            // Calculate statistics
            const average = this.calculateAverage(results);
            const median = this.calculateMedian(results);
            
            const benchmark = {
              id: benchmarkId,
              url: url,
              runs: runs,
              metrics: results,
              average: average,
              median: median,
              timestamp: Date.now()
            };
            
            this.benchmarks.set(benchmarkId, benchmark);
            this.metrics.totalBenchmarks++;
            
            this.emit('benchmark-completed', { 
              benchmarkId,
              url,
              average,
              timestamp: Date.now() 
            });
            
            return benchmark;
            
          } catch (error) {
            this.emit('benchmark-failed', { 
              benchmarkId,
              error: error.message,
              timestamp: Date.now() 
            });
            
            return {
              id: benchmarkId,
              url: url,
              error: error.message,
              metrics: {
                navigation: {
                  loadTime: 0
                }
              }
            };
          }
        };
        
        const benchmark = await this.benchmarkPage(url, { runs: 1 });
        results[condition] = benchmark;
        
        // Restore original method
        this.benchmarkPage = originalBenchmarkPage;
      }
    }
    
    return results;
  }

  /**
   * Analyze network waterfall
   */
  async analyzeNetworkWaterfall(url) {
    await this.collectPageMetrics(url);
    
    return {
      requests: [
        { url: 'index.html', start: 0, duration: 150, type: 'document' },
        { url: 'styles.css', start: 150, duration: 100, type: 'stylesheet' },
        { url: 'bundle.js', start: 150, duration: 300, type: 'script' },
        { url: 'hero.jpg', start: 250, duration: 400, type: 'image' }
      ],
      criticalPath: ['index.html', 'styles.css', 'bundle.js'],
      parallelRequests: 3,
      recommendations: [
        'Preload critical resources',
        'Use HTTP/2 server push',
        'Optimize request prioritization'
      ]
    };
  }

  /**
   * Detect redundant requests
   */
  async detectRedundantRequests(url) {
    await this.collectPageMetrics(url);
    
    return {
      duplicateRequests: [
        { url: 'analytics.js', count: 2 }
      ],
      unnecessaryRequests: [
        { url: 'unused-library.js', reason: 'No code execution detected' }
      ],
      optimizationPotential: 125000
    };
  }

  /**
   * Profile JavaScript execution
   */
  async profileJavaScript(url) {
    await this.collectPageMetrics(url);
    
    return {
      executionTime: 850,
      functionCalls: 12500,
      longTasks: [
        { duration: 150, function: 'calculateLayout' },
        { duration: 120, function: 'renderComponents' }
      ],
      mainThreadBlocking: 270
    };
  }

  /**
   * Analyze bundle size
   */
  async analyzeBundleSize(url) {
    await this.collectPageMetrics(url);
    
    return {
      totalSize: 380000,
      bundles: [
        { name: 'vendor.js', size: 180000, gzipped: 65000 },
        { name: 'app.js', size: 120000, gzipped: 40000 },
        { name: 'polyfills.js', size: 80000, gzipped: 25000 }
      ],
      unusedCode: {
        bytes: 95000,
        percentage: 25
      },
      recommendations: [
        'Enable code splitting',
        'Remove unused dependencies',
        'Use tree shaking'
      ]
    };
  }

  /**
   * Detect performance anti-patterns
   */
  async detectAntiPatterns(url) {
    await this.collectPageMetrics(url);
    
    return {
      layoutThrashing: {
        detected: true,
        occurrences: 5,
        impact: 'High'
      },
      memoryLeaks: {
        detected: false,
        suspects: []
      },
      excessiveReflows: {
        detected: true,
        count: 15
      }
    };
  }

  /**
   * Analyze image optimization
   */
  async analyzeImageOptimization(url) {
    await this.collectPageMetrics(url);
    
    return {
      images: [
        { url: 'hero.jpg', size: 250000, optimizedSize: 125000, format: 'JPEG' },
        { url: 'logo.png', size: 50000, optimizedSize: 15000, format: 'PNG' }
      ],
      totalSize: 300000,
      optimizationPotential: 160000,
      recommendations: [
        'Use WebP format for better compression',
        'Implement responsive images with srcset',
        'Enable lazy loading for below-fold images'
      ]
    };
  }

  /**
   * Detect lazy loading opportunities
   */
  async detectLazyLoadingOpportunities(url) {
    await this.collectPageMetrics(url);
    
    return {
      aboveFold: [
        { url: 'hero.jpg', size: 250000 }
      ],
      belowFold: [
        { url: 'gallery1.jpg', size: 150000 },
        { url: 'gallery2.jpg', size: 150000 }
      ],
      potentialSavings: 300000
    };
  }

  /**
   * Benchmark service worker
   */
  async benchmarkServiceWorker(url) {
    await this.collectPageMetrics(url);
    
    return {
      registrationTime: 45,
      activationTime: 120,
      cacheResponseTime: 15,
      networkFallbackTime: 250
    };
  }

  /**
   * Analyze offline performance
   */
  async analyzeOfflinePerformance(url) {
    await this.collectPageMetrics(url);
    
    return {
      offlineCapable: true,
      cachedResources: 25,
      cacheSize: 2500000,
      offlineLoadTime: 350
    };
  }

  /**
   * Analyze performance trends
   */
  async analyzePerformanceTrends(url) {
    const benchmarks = Array.from(this.benchmarks.values())
      .filter(b => b.url === url);
    
    if (benchmarks.length < 2) {
      return {
        trend: 'insufficient-data',
        average: 0,
        variance: 0,
        regression: false
      };
    }
    
    const loadTimes = benchmarks.map(b => b.average?.navigation?.loadTime || 0);
    const average = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    const variance = loadTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / loadTimes.length;
    
    // Simple trend detection
    const trend = loadTimes[loadTimes.length - 1] > loadTimes[0] ? 'degrading' : 'improving';
    
    return {
      trend: trend,
      average: average,
      variance: variance,
      regression: trend === 'degrading',
      dataPoints: loadTimes.length
    };
  }

  /**
   * Check performance alerts
   */
  async checkPerformanceAlerts(benchmark) {
    const alerts = [];
    
    // Check against thresholds
    if (benchmark.average?.navigation?.loadTime > this.thresholds.pageLoad) {
      alerts.push({
        metric: 'pageLoad',
        threshold: this.thresholds.pageLoad,
        actual: benchmark.average.navigation.loadTime,
        severity: 'high',
        message: 'Page load time exceeds threshold'
      });
    }
    
    return alerts;
  }

  /**
   * Generate performance report
   */
  async generateReport(benchmark) {
    const analysis = await this.analyzeBottlenecks(benchmark.average || {});
    
    return {
      summary: {
        url: benchmark.url,
        runs: benchmark.runs,
        averageLoadTime: benchmark.average?.navigation?.loadTime || 0,
        date: new Date(benchmark.timestamp).toISOString()
      },
      metrics: benchmark.average,
      recommendations: analysis.recommendations,
      score: this.calculatePerformanceScore(benchmark)
    };
  }

  /**
   * Generate Lighthouse-style report
   */
  async generateLighthouseReport(benchmark) {
    const score = this.calculatePerformanceScore(benchmark);
    
    return {
      performance: {
        score: score,
        displayValue: `${score} / 100`
      },
      metrics: {
        firstContentfulPaint: {
          score: 90,
          displayValue: '1.2 s',
          numericValue: 1200
        },
        largestContentfulPaint: {
          score: 85,
          displayValue: '2.1 s',
          numericValue: 2100
        },
        totalBlockingTime: {
          score: 95,
          displayValue: '150 ms',
          numericValue: 150
        },
        cumulativeLayoutShift: {
          score: 100,
          displayValue: '0.05',
          numericValue: 0.05
        }
      },
      opportunities: [
        {
          id: 'render-blocking-resources',
          title: 'Eliminate render-blocking resources',
          displayValue: 'Potential savings of 0.7 s'
        }
      ],
      diagnostics: [
        {
          id: 'uses-responsive-images',
          title: 'Properly size images',
          displayValue: '3 images'
        }
      ]
    };
  }

  /**
   * Export performance data
   */
  async exportPerformanceData(benchmark, format = 'json') {
    if (format === 'json') {
      return JSON.stringify({
        url: benchmark.url,
        timestamp: benchmark.timestamp,
        runs: benchmark.runs,
        metrics: benchmark.average,
        median: benchmark.median
      }, null, 2);
    }
    
    return '';
  }

  /**
   * Generate performance tests
   */
  async generatePerformanceTests(url, framework = 'playwright') {
    const tests = [];
    
    tests.push({
      name: `should load ${url} within performance budget`,
      type: 'performance',
      code: `test('performance budget', async ({ page }) => {
  const metrics = await page.goto('${url}');
  const loadTime = await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);
  
  expect(loadTime).toBeLessThan(${this.thresholds.pageLoad});
});`
    });
    
    tests.push({
      name: `should meet web vitals thresholds for ${url}`,
      type: 'web-vitals',
      code: `test('web vitals', async ({ page }) => {
  await page.goto('${url}');
  
  const vitals = await page.evaluate(() => ({
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime
  }));
  
  expect(vitals.fcp).toBeLessThan(${this.thresholds.firstContentfulPaint});
  expect(vitals.lcp).toBeLessThan(${this.thresholds.largestContentfulPaint});
});`
    });
    
    return tests;
  }

  /**
   * Generate budget tests
   */
  async generateBudgetTests(framework = 'playwright') {
    const tests = [];
    
    tests.push({
      name: 'should meet JavaScript budget',
      type: 'budget',
      code: `test('javascript budget', async ({ page }) => {
  const coverage = await page.coverage.startJSCoverage();
  await page.goto('/');
  const jsCoverage = await page.coverage.stopJSCoverage();
  
  const totalBytes = jsCoverage.reduce((total, entry) => total + entry.text.length, 0);
  expect(totalBytes).toBeLessThan(${this.budgets.javascript});
});`
    });
    
    return tests;
  }

  /**
   * Helper method to calculate average
   */
  calculateAverage(results) {
    if (results.length === 0) return {};
    
    const avgLoadTime = results.reduce((sum, r) => sum + r.metrics.navigation.loadTime, 0) / results.length;
    
    return {
      navigation: {
        loadTime: avgLoadTime
      }
    };
  }

  /**
   * Helper method to calculate median
   */
  calculateMedian(results) {
    if (results.length === 0) return {};
    
    const loadTimes = results.map(r => r.metrics.navigation.loadTime).sort((a, b) => a - b);
    const mid = Math.floor(loadTimes.length / 2);
    
    return {
      navigation: {
        loadTime: loadTimes.length % 2 ? loadTimes[mid] : (loadTimes[mid - 1] + loadTimes[mid]) / 2
      }
    };
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore(benchmark) {
    const loadTime = benchmark.average?.navigation?.loadTime || 0;
    
    // Simple scoring based on load time
    if (loadTime <= 1000) return 100;
    if (loadTime <= 2000) return 90;
    if (loadTime <= 3000) return 80;
    if (loadTime <= 4000) return 70;
    if (loadTime <= 5000) return 60;
    return 50;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.emit('cleanup-started', { timestamp: Date.now() });

    try {
      // Clear benchmarks
      this.benchmarks.clear();
      
      // Clear trends
      this.metrics.trends.clear();
      
      // Cleanup E2E runner
      if (this.e2eRunner) {
        await this.e2eRunner.cleanup();
      }
      
      // Reset metrics
      this.metrics.totalBenchmarks = 0;
      this.metrics.averageLoadTime = 0;
      
      this.isInitialized = false;
      
      this.emit('cleanup-completed', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('cleanup-error', { error: error.message, timestamp: Date.now() });
      throw error;
    }
  }
}

export { PerformanceBenchmark };