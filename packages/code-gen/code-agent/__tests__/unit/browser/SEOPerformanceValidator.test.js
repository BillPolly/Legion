/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { SEOPerformanceValidator } from '../../../src/browser/SEOPerformanceValidator.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SEOPerformanceValidator', () => {
  let validator;
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
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-seo-performance-project');
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
    validator = new SEOPerformanceValidator(mockConfig);
  });

  afterEach(async () => {
    if (validator) {
      await validator.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(validator.config).toBeDefined();
      expect(validator.isInitialized).toBe(false);
      expect(validator.validationEngine).toBeDefined();
    });

    test('should initialize successfully', async () => {
      await validator.initialize();
      
      expect(validator.isInitialized).toBe(true);
      expect(validator.validationEngine.isInitialized).toBe(true);
    });
  });

  describe('Comprehensive SEO Analysis', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should perform complete SEO audit', async () => {
      const result = await validator.performSEOAudit('/page');
      
      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.metaTags).toBeDefined();
      expect(result.structuredData).toBeDefined();
      expect(result.canonicalURL).toBeDefined();
      expect(result.openGraph).toBeDefined();
      expect(result.twitterCards).toBeDefined();
      expect(result.robots).toBeDefined();
      expect(result.sitemap).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should analyze keyword optimization', async () => {
      const result = await validator.analyzeKeywordOptimization('/page', ['test', 'validation']);
      
      expect(result).toBeDefined();
      expect(result.keywordDensity).toBeDefined();
      expect(result.keywordPlacement).toBeDefined();
      expect(result.relatedKeywords).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should validate rich snippets', async () => {
      const result = await validator.validateRichSnippets('/product-page');
      
      expect(result).toBeDefined();
      expect(result.productSchema).toBeDefined();
      expect(result.reviewSchema).toBeDefined();
      expect(result.breadcrumbs).toBeDefined();
      expect(result.valid).toBeDefined();
    });

    test('should check social media optimization', async () => {
      const result = await validator.checkSocialMediaOptimization('/page');
      
      expect(result).toBeDefined();
      expect(result.openGraph).toBeDefined();
      expect(result.twitterCards).toBeDefined();
      expect(result.pinterest).toBeDefined();
      expect(result.shareability).toBeDefined();
    });

    test('should analyze internal linking', async () => {
      const result = await validator.analyzeInternalLinking('/page');
      
      expect(result).toBeDefined();
      expect(result.totalInternalLinks).toBeDefined();
      expect(result.linkDistribution).toBeDefined();
      expect(result.orphanPages).toBeDefined();
      expect(result.linkDepth).toBeDefined();
    });
  });

  describe('Advanced Performance Analysis', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should analyze Core Web Vitals', async () => {
      const result = await validator.analyzeCoreWebVitals('/page');
      
      expect(result).toBeDefined();
      expect(result.LCP).toBeDefined();
      expect(result.FID).toBeDefined();
      expect(result.CLS).toBeDefined();
      expect(result.INP).toBeDefined();
      expect(result.TTFB).toBeDefined();
      expect(result.score).toBeDefined();
    });

    test('should detect render-blocking resources', async () => {
      const result = await validator.detectRenderBlockingResources('/page');
      
      expect(result).toBeDefined();
      expect(result.css).toBeDefined();
      expect(result.javascript).toBeDefined();
      expect(result.fonts).toBeDefined();
      expect(result.impact).toBeDefined();
      expect(result.solutions).toBeDefined();
    });

    test('should analyze third-party impact', async () => {
      const result = await validator.analyzeThirdPartyImpact('/page');
      
      expect(result).toBeDefined();
      expect(result.scripts).toBeDefined();
      expect(result.totalSize).toBeDefined();
      expect(result.blockingTime).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should optimize critical rendering path', async () => {
      const result = await validator.optimizeCriticalRenderingPath('/page');
      
      expect(result).toBeDefined();
      expect(result.criticalCSS).toBeDefined();
      expect(result.aboveFoldContent).toBeDefined();
      expect(result.deferredResources).toBeDefined();
      expect(result.optimizations).toBeDefined();
    });

    test('should analyze runtime performance', async () => {
      const result = await validator.analyzeRuntimePerformance('/page');
      
      expect(result).toBeDefined();
      expect(result.longTasks).toBeDefined();
      expect(result.mainThreadWork).toBeDefined();
      expect(result.jsExecutionTime).toBeDefined();
      expect(result.layoutThrashing).toBeDefined();
    });
  });

  describe('Mobile SEO and Performance', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should validate mobile SEO', async () => {
      const result = await validator.validateMobileSEO('/page');
      
      expect(result).toBeDefined();
      expect(result.mobileUsability).toBeDefined();
      expect(result.pageSpeed).toBeDefined();
      expect(result.ampValidation).toBeDefined();
      expect(result.mobileFirstIndexing).toBeDefined();
    });

    test('should analyze mobile performance', async () => {
      const result = await validator.analyzeMobilePerformanceMetrics('/page');
      
      expect(result).toBeDefined();
      expect(result.mobileScore).toBeDefined();
      expect(result.loadTime).toBeDefined();
      expect(result.interactiveTime).toBeDefined();
      expect(result.dataUsage).toBeDefined();
    });
  });

  describe('Technical SEO', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should validate XML sitemap', async () => {
      const result = await validator.validateXMLSitemap('/sitemap.xml');
      
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.urlCount).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.lastModified).toBeDefined();
      expect(result.coverage).toBeDefined();
    });

    test('should check robots.txt', async () => {
      const result = await validator.checkRobotsTxt('/robots.txt');
      
      expect(result).toBeDefined();
      expect(result.exists).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.disallowedPaths).toBeDefined();
      expect(result.crawlDelay).toBeDefined();
      expect(result.sitemapReference).toBeDefined();
    });

    test('should analyze URL structure', async () => {
      const result = await validator.analyzeURLStructure('/page');
      
      expect(result).toBeDefined();
      expect(result.urlLength).toBeDefined();
      expect(result.urlDepth).toBeDefined();
      expect(result.seoFriendly).toBeDefined();
      expect(result.parameterUsage).toBeDefined();
    });

    test('should validate hreflang implementation', async () => {
      const result = await validator.validateHreflang('/page');
      
      expect(result).toBeDefined();
      expect(result.languages).toBeDefined();
      expect(result.reciprocalLinks).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.coverage).toBeDefined();
    });
  });

  describe('Content Optimization', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should analyze content quality', async () => {
      const result = await validator.analyzeContentQuality('/page');
      
      expect(result).toBeDefined();
      expect(result.wordCount).toBeDefined();
      expect(result.readability).toBeDefined();
      expect(result.uniqueness).toBeDefined();
      expect(result.semanticStructure).toBeDefined();
    });

    test('should check heading hierarchy', async () => {
      const result = await validator.checkHeadingHierarchy('/page');
      
      expect(result).toBeDefined();
      expect(result.h1Count).toBeDefined();
      expect(result.hierarchy).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should optimize images for SEO', async () => {
      const result = await validator.optimizeImagesForSEO('/page');
      
      expect(result).toBeDefined();
      expect(result.images).toBeDefined();
      expect(result.missingAltText).toBeDefined();
      expect(result.oversizedImages).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Performance Budgets', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should validate performance budgets', async () => {
      const budgets = {
        javascript: 300000,
        css: 100000,
        images: 500000,
        total: 1000000
      };
      
      const result = await validator.validatePerformanceBudgets('/page', budgets);
      
      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should suggest performance optimizations', async () => {
      const result = await validator.suggestPerformanceOptimizations('/page');
      
      expect(result).toBeDefined();
      expect(result.highPriority).toBeDefined();
      expect(result.mediumPriority).toBeDefined();
      expect(result.lowPriority).toBeDefined();
      expect(result.estimatedImpact).toBeDefined();
    });
  });

  describe('Competitive Analysis', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should compare SEO metrics', async () => {
      const result = await validator.compareSEOMetrics('/page', ['/competitor1', '/competitor2']);
      
      expect(result).toBeDefined();
      expect(result.comparison).toBeDefined();
      expect(result.strengths).toBeDefined();
      expect(result.weaknesses).toBeDefined();
      expect(result.opportunities).toBeDefined();
    });

    test('should benchmark performance', async () => {
      const result = await validator.benchmarkPerformance('/page', ['/competitor1', '/competitor2']);
      
      expect(result).toBeDefined();
      expect(result.rankings).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.improvements).toBeDefined();
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should generate comprehensive SEO report', async () => {
      await validator.performSEOAudit('/page');
      const report = await validator.generateSEOReport();
      
      expect(report).toBeDefined();
      expect(report.executive).toBeDefined();
      expect(report.technical).toBeDefined();
      expect(report.content).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.actionItems).toBeDefined();
    });

    test('should generate performance report', async () => {
      await validator.analyzeCoreWebVitals('/page');
      const report = await validator.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.opportunities).toBeDefined();
      expect(report.diagnostics).toBeDefined();
    });

    test('should export reports in multiple formats', async () => {
      await validator.performSEOAudit('/page');
      
      const jsonReport = await validator.exportReport('json');
      expect(jsonReport).toBeDefined();
      expect(typeof jsonReport).toBe('string');
      
      const htmlReport = await validator.exportReport('html');
      expect(htmlReport).toBeDefined();
      expect(htmlReport).toContain('<html>');
    });
  });

  describe('Real-time Monitoring', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should monitor SEO changes', async () => {
      const monitor = await validator.startSEOMonitoring('/page', {
        interval: 1000,
        duration: 3000
      });
      
      expect(monitor).toBeDefined();
      expect(monitor.id).toBeDefined();
      
      await validator.stopMonitoring(monitor.id);
    });

    test('should track performance metrics', async () => {
      const tracker = await validator.trackPerformanceMetrics('/page', {
        metrics: ['LCP', 'FID', 'CLS'],
        interval: 1000
      });
      
      expect(tracker).toBeDefined();
      expect(tracker.id).toBeDefined();
      
      await validator.stopTracking(tracker.id);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should handle invalid URLs gracefully', async () => {
      const result = await validator.performSEOAudit('invalid://url');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('should handle timeout errors', async () => {
      const result = await validator.analyzeCoreWebVitals('/timeout-page');
      
      expect(result).toBeDefined();
      expect(result.error || result.score).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await validator.initialize();
      
      // Run some validations
      await validator.performSEOAudit('/page');
      await validator.analyzeCoreWebVitals('/page');
      
      expect(validator.monitors.size).toBe(0);
      
      await validator.cleanup();
      
      expect(validator.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample pages for SEO/Performance testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.html'),
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="SEO and Performance test page with comprehensive optimization">
  <meta name="keywords" content="test, validation, seo, performance">
  <meta property="og:title" content="SEO Performance Test Page">
  <meta property="og:description" content="A comprehensive test page for SEO and performance validation">
  <meta property="og:image" content="https://example.com/og-image.jpg">
  <meta property="og:url" content="https://example.com/page">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SEO Performance Test Page">
  <meta name="twitter:description" content="A comprehensive test page for SEO and performance validation">
  <title>SEO Performance Test Page - Comprehensive Validation</title>
  <link rel="canonical" href="https://example.com/page">
  <link rel="alternate" hreflang="en" href="https://example.com/en/page">
  <link rel="alternate" hreflang="es" href="https://example.com/es/page">
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <style>
    /* Critical CSS */
    body { margin: 0; font-family: Arial, sans-serif; }
    .header { background: #333; color: white; padding: 20px; }
  </style>
  <link rel="stylesheet" href="styles.css" media="print" onload="this.media='all'">
</head>
<body>
  <header class="header">
    <h1>SEO Performance Test Page</h1>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/products">Products</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>
  
  <main>
    <article>
      <h2>Main Content Section</h2>
      <p>This is a test page designed to validate SEO and performance optimization features. It includes all necessary meta tags, structured data, and performance optimizations.</p>
      
      <section>
        <h3>Performance Optimizations</h3>
        <ul>
          <li>Critical CSS inlined</li>
          <li>Non-critical CSS deferred</li>
          <li>Images lazy loaded</li>
          <li>JavaScript deferred</li>
        </ul>
      </section>
      
      <section>
        <h3>SEO Features</h3>
        <ul>
          <li>Comprehensive meta tags</li>
          <li>Structured data markup</li>
          <li>Proper heading hierarchy</li>
          <li>Internal linking structure</li>
        </ul>
      </section>
    </article>
    
    <aside>
      <h3>Related Content</h3>
      <ul>
        <li><a href="/seo-guide">SEO Best Practices Guide</a></li>
        <li><a href="/performance-tips">Performance Optimization Tips</a></li>
        <li><a href="/web-vitals">Understanding Core Web Vitals</a></li>
      </ul>
    </aside>
  </main>
  
  <footer>
    <p>&copy; 2024 SEO Performance Test. All rights reserved.</p>
  </footer>
  
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "SEO Performance Test Page",
    "description": "A comprehensive test page for SEO and performance validation",
    "url": "https://example.com/page",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://example.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Test Page",
          "item": "https://example.com/page"
        }
      ]
    }
  }
  </script>
  
  <script src="app.js" defer></script>
</body>
</html>
`
  );
  
  // Create robots.txt
  await fs.writeFile(
    path.join(projectPath, 'src', 'robots.txt'),
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/
Crawl-delay: 1

Sitemap: https://example.com/sitemap.xml
`
  );
  
  // Create comprehensive sitemap
  await fs.writeFile(
    path.join(projectPath, 'src', 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/page</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.com/products</loc>
    <lastmod>2024-01-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`
  );
}