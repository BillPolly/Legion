/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { PerformanceBenchmark } from '../../../src/browser/PerformanceBenchmark.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PerformanceBenchmark', () => {
  let performanceBenchmark;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      },
      playwright: {
        headless: true,
        timeout: 30000,
        browsers: ['chromium'],
        baseURL: 'http://localhost:3000'
      },
      performance: {
        thresholds: {
          pageLoad: 3000,
          firstContentfulPaint: 1500,
          largestContentfulPaint: 2500,
          timeToInteractive: 3500,
          totalBlockingTime: 300
        },
        budgets: {
          javascript: 300000, // 300KB
          css: 100000, // 100KB
          images: 500000, // 500KB
          total: 1000000 // 1MB
        }
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-performance-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    performanceBenchmark = new PerformanceBenchmark(mockConfig);
  });

    afterEach(async () => {
    if (performanceBenchmark) {
      try {
        await performanceBenchmark.cleanup();
      } catch (error) {
        console.warn('Cleanup error (ignored):', error.message);
      }
      performanceBenchmark = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(performanceBenchmark.config).toBeDefined();
      expect(performanceBenchmark.isInitialized).toBe(false);
      expect(performanceBenchmark.benchmarks).toBeInstanceOf(Map);
      expect(performanceBenchmark.thresholds).toBeDefined();
    });

    test('should initialize successfully', async () => {
      await performanceBenchmark.initialize();
      
      expect(performanceBenchmark.isInitialized).toBe(true);
      expect(performanceBenchmark.e2eRunner).toBeDefined();
      expect(performanceBenchmark.logManager).toBeDefined();
    });

    test('should load performance thresholds', async () => {
      await performanceBenchmark.initialize();
      
      expect(performanceBenchmark.thresholds).toBeDefined();
      expect(performanceBenchmark.thresholds.pageLoad).toBe(3000);
      expect(performanceBenchmark.budgets).toBeDefined();
      expect(performanceBenchmark.budgets.javascript).toBe(300000);
    });
  });

  describe('Performance Metrics Collection', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should collect page load metrics', async () => {
      const metrics = await performanceBenchmark.collectPageMetrics('/home');
      
      expect(metrics).toBeDefined();
      expect(metrics.navigation).toBeDefined();
      expect(metrics.navigation.loadTime).toBeDefined();
      expect(metrics.navigation.domContentLoaded).toBeDefined();
      expect(metrics.navigation.domInteractive).toBeDefined();
    });

    test('should collect web vitals', async () => {
      const vitals = await performanceBenchmark.collectWebVitals('/home');
      
      expect(vitals).toBeDefined();
      expect(vitals.FCP).toBeDefined(); // First Contentful Paint
      expect(vitals.LCP).toBeDefined(); // Largest Contentful Paint
      expect(vitals.FID).toBeDefined(); // First Input Delay
      expect(vitals.CLS).toBeDefined(); // Cumulative Layout Shift
      expect(vitals.TTI).toBeDefined(); // Time to Interactive
      expect(vitals.TBT).toBeDefined(); // Total Blocking Time
    });

    test('should collect resource metrics', async () => {
      const resources = await performanceBenchmark.collectResourceMetrics('/home');
      
      expect(resources).toBeDefined();
      expect(resources.summary).toBeDefined();
      expect(resources.summary.totalSize).toBeDefined();
      expect(resources.summary.totalRequests).toBeDefined();
      expect(resources.byType).toBeDefined();
      expect(resources.byType.script).toBeDefined();
      expect(resources.byType.stylesheet).toBeDefined();
    });

    test('should collect memory metrics', async () => {
      const memory = await performanceBenchmark.collectMemoryMetrics('/home');
      
      expect(memory).toBeDefined();
      expect(memory.jsHeapSize).toBeDefined();
      expect(memory.totalJSHeapSize).toBeDefined();
      expect(memory.usedJSHeapSize).toBeDefined();
      expect(memory.heapUtilization).toBeDefined();
    });
  });

  describe('Benchmark Execution', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should run single page benchmark', async () => {
      const result = await performanceBenchmark.benchmarkPage('/home', {
        runs: 3,
        warmup: 1
      });
      
      expect(result).toBeDefined();
      expect(result.url).toBe('/home');
      expect(result.runs).toBe(3);
      expect(result.metrics).toBeDefined();
      expect(result.average).toBeDefined();
      expect(result.median).toBeDefined();
    });

    test('should run multi-page benchmark', async () => {
      const pages = ['/home', '/about', '/contact'];
      const results = await performanceBenchmark.benchmarkPages(pages, {
        runs: 2
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].url).toBe('/home');
      expect(results[1].url).toBe('/about');
      expect(results[2].url).toBe('/contact');
    });

    test('should run user journey benchmark', async () => {
      const journey = {
        name: 'User Signup Flow',
        steps: [
          { action: 'navigate', url: '/home' },
          { action: 'click', selector: '#signup' },
          { action: 'fill', selector: '#email', value: 'test@example.com' },
          { action: 'click', selector: '#submit' }
        ]
      };
      
      const result = await performanceBenchmark.benchmarkUserJourney(journey);
      
      expect(result).toBeDefined();
      expect(result.journey).toBe('User Signup Flow');
      expect(result.steps).toHaveLength(4);
      expect(result.totalDuration).toBeDefined();
      expect(result.stepMetrics).toBeDefined();
    });

    test('should compare benchmarks', async () => {
      const baseline = await performanceBenchmark.benchmarkPage('/home');
      const current = await performanceBenchmark.benchmarkPage('/home');
      
      const comparison = await performanceBenchmark.compareBenchmarks(baseline, current);
      
      expect(comparison).toBeDefined();
      expect(comparison.regression).toBeDefined();
      expect(comparison.improvements).toBeDefined();
      expect(comparison.percentageChange).toBeDefined();
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should analyze performance bottlenecks', async () => {
      const metrics = await performanceBenchmark.collectPageMetrics('/slow-page');
      const analysis = await performanceBenchmark.analyzeBottlenecks(metrics);
      
      expect(analysis).toBeDefined();
      expect(analysis.bottlenecks).toBeDefined();
      expect(Array.isArray(analysis.bottlenecks)).toBe(true);
      expect(analysis.recommendations).toBeDefined();
    });

    test('should check performance budget', async () => {
      const metrics = await performanceBenchmark.collectResourceMetrics('/home');
      const budgetCheck = await performanceBenchmark.checkBudget(metrics);
      
      expect(budgetCheck).toBeDefined();
      expect(budgetCheck.passed).toBeDefined();
      expect(budgetCheck.violations).toBeDefined();
      expect(budgetCheck.summary).toBeDefined();
    });

    test('should analyze render blocking resources', async () => {
      const analysis = await performanceBenchmark.analyzeRenderBlocking('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.renderBlockingCSS).toBeDefined();
      expect(analysis.renderBlockingJS).toBeDefined();
      expect(analysis.impact).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should analyze cache effectiveness', async () => {
      const analysis = await performanceBenchmark.analyzeCacheEffectiveness('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.cacheHitRate).toBeDefined();
      expect(analysis.uncachedResources).toBeDefined();
      expect(analysis.potentialSavings).toBeDefined();
    });
  });

  describe('Network Performance', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should benchmark under different network conditions', async () => {
      const conditions = ['3G', '4G', 'WiFi'];
      const results = await performanceBenchmark.benchmarkNetworkConditions('/home', conditions);
      
      expect(results).toBeDefined();
      expect(results['3G']).toBeDefined();
      expect(results['4G']).toBeDefined();
      expect(results['WiFi']).toBeDefined();
      expect(results['3G'].average.navigation.loadTime).toBeGreaterThan(
        results['WiFi'].average.navigation.loadTime
      );
    });

    test('should analyze network waterfall', async () => {
      const waterfall = await performanceBenchmark.analyzeNetworkWaterfall('/home');
      
      expect(waterfall).toBeDefined();
      expect(waterfall.requests).toBeDefined();
      expect(waterfall.criticalPath).toBeDefined();
      expect(waterfall.parallelRequests).toBeDefined();
      expect(waterfall.recommendations).toBeDefined();
    });

    test('should detect redundant requests', async () => {
      const analysis = await performanceBenchmark.detectRedundantRequests('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.duplicateRequests).toBeDefined();
      expect(analysis.unnecessaryRequests).toBeDefined();
      expect(analysis.optimizationPotential).toBeDefined();
    });
  });

  describe('JavaScript Performance', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should profile JavaScript execution', async () => {
      const profile = await performanceBenchmark.profileJavaScript('/home');
      
      expect(profile).toBeDefined();
      expect(profile.executionTime).toBeDefined();
      expect(profile.functionCalls).toBeDefined();
      expect(profile.longTasks).toBeDefined();
      expect(profile.mainThreadBlocking).toBeDefined();
    });

    test('should analyze bundle size', async () => {
      const analysis = await performanceBenchmark.analyzeBundleSize('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.totalSize).toBeDefined();
      expect(analysis.bundles).toBeDefined();
      expect(analysis.unusedCode).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should detect performance anti-patterns', async () => {
      const antiPatterns = await performanceBenchmark.detectAntiPatterns('/home');
      
      expect(antiPatterns).toBeDefined();
      expect(antiPatterns.layoutThrashing).toBeDefined();
      expect(antiPatterns.memoryLeaks).toBeDefined();
      expect(antiPatterns.excessiveReflows).toBeDefined();
    });
  });

  describe('Image Performance', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should analyze image optimization', async () => {
      const analysis = await performanceBenchmark.analyzeImageOptimization('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.images).toBeDefined();
      expect(analysis.totalSize).toBeDefined();
      expect(analysis.optimizationPotential).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    test('should detect lazy loading opportunities', async () => {
      const opportunities = await performanceBenchmark.detectLazyLoadingOpportunities('/home');
      
      expect(opportunities).toBeDefined();
      expect(opportunities.aboveFold).toBeDefined();
      expect(opportunities.belowFold).toBeDefined();
      expect(opportunities.potentialSavings).toBeDefined();
    });
  });

  describe('Progressive Web App Performance', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should benchmark service worker performance', async () => {
      const swPerf = await performanceBenchmark.benchmarkServiceWorker('/home');
      
      expect(swPerf).toBeDefined();
      expect(swPerf.registrationTime).toBeDefined();
      expect(swPerf.activationTime).toBeDefined();
      expect(swPerf.cacheResponseTime).toBeDefined();
    });

    test('should analyze offline performance', async () => {
      const analysis = await performanceBenchmark.analyzeOfflinePerformance('/home');
      
      expect(analysis).toBeDefined();
      expect(analysis.offlineCapable).toBeDefined();
      expect(analysis.cachedResources).toBeDefined();
      expect(analysis.offlineLoadTime).toBeDefined();
    });
  });

  describe('Continuous Performance Monitoring', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should track performance trends', async () => {
      // Run multiple benchmarks
      await performanceBenchmark.benchmarkPage('/home');
      await performanceBenchmark.benchmarkPage('/home');
      await performanceBenchmark.benchmarkPage('/home');
      
      const trends = await performanceBenchmark.analyzePerformanceTrends('/home');
      
      expect(trends).toBeDefined();
      expect(trends.trend).toBeDefined();
      expect(trends.average).toBeDefined();
      expect(trends.variance).toBeDefined();
      expect(trends.regression).toBeDefined();
    });

    test('should generate performance alerts', async () => {
      const result = await performanceBenchmark.benchmarkPage('/slow-page');
      const alerts = await performanceBenchmark.checkPerformanceAlerts(result);
      
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      if (alerts.length > 0) {
        expect(alerts[0].metric).toBeDefined();
        expect(alerts[0].threshold).toBeDefined();
        expect(alerts[0].actual).toBeDefined();
        expect(alerts[0].severity).toBeDefined();
      }
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should generate performance report', async () => {
      const result = await performanceBenchmark.benchmarkPage('/home');
      const report = await performanceBenchmark.generateReport(result);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.score).toBeDefined();
    });

    test('should generate lighthouse-style report', async () => {
      const result = await performanceBenchmark.benchmarkPage('/home');
      const report = await performanceBenchmark.generateLighthouseReport(result);
      
      expect(report).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.performance.score).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.opportunities).toBeDefined();
      expect(report.diagnostics).toBeDefined();
    });

    test('should export performance data', async () => {
      const result = await performanceBenchmark.benchmarkPage('/home');
      const exportData = await performanceBenchmark.exportPerformanceData(result, 'json');
      
      expect(exportData).toBeDefined();
      expect(typeof exportData).toBe('string');
      const parsed = JSON.parse(exportData);
      expect(parsed.url).toBe('/home');
      expect(parsed.metrics).toBeDefined();
    });
  });

  describe('Test Generation', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should generate performance tests', async () => {
      const tests = await performanceBenchmark.generatePerformanceTests('/home', 'playwright');
      
      expect(tests).toBeDefined();
      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].name).toBeDefined();
      expect(tests[0].code).toContain('expect');
    });

    test('should generate budget tests', async () => {
      const tests = await performanceBenchmark.generateBudgetTests('playwright');
      
      expect(tests).toBeDefined();
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('budget');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await performanceBenchmark.initialize();
    });

    test('should handle page load failures', async () => {
      const result = await performanceBenchmark.benchmarkPage('/non-existent');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('should handle timeout errors', async () => {
      const result = await performanceBenchmark.benchmarkPage('/timeout-page', {
        timeout: 100
      });
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await performanceBenchmark.initialize();
      
      // Run some benchmarks
      await performanceBenchmark.benchmarkPage('/home');
      
      expect(performanceBenchmark.benchmarks.size).toBeGreaterThan(0);
      
      await performanceBenchmark.cleanup();
      
      expect(performanceBenchmark.benchmarks.size).toBe(0);
      expect(performanceBenchmark.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample pages for performance testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Test Page</title>
  <link rel="stylesheet" href="styles.css">
  <script src="bundle.js" defer></script>
</head>
<body>
  <header>
    <h1>Performance Test</h1>
  </header>
  
  <main>
    <div class="hero">
      <img src="hero.jpg" alt="Hero image" loading="lazy">
    </div>
    
    <section class="content">
      <p>Content for performance testing</p>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2024 Performance Test</p>
  </footer>
</body>
</html>
`
  );
  
  // Create slow page for testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'slow-page.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Slow Page</title>
  <script>
    // Simulate slow JavaScript
    const start = Date.now();
    while (Date.now() - start < 2000) {
      // Block for 2 seconds
    }
  </script>
</head>
<body>
  <h1>Slow Loading Page</h1>
  <script>
    // More blocking code
    for (let i = 0; i < 1000000; i++) {
      document.createElement('div');
    }
  </script>
</body>
</html>
`
  );
}