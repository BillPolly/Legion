/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { FrontendValidationEngine } from '../../../src/browser/FrontendValidationEngine.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FrontendValidationEngine', () => {
  let validationEngine;
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
    testProjectPath = path.join(__dirname, 'temp-validation-project');
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
    validationEngine = new FrontendValidationEngine(mockConfig);
  });

    afterEach(async () => {
    if (validationEngine) {
      try {
        await validationEngine.cleanup();
      } catch (error) {
        console.warn('Cleanup error (ignored):', error.message);
      }
      validationEngine = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(validationEngine.config).toBeDefined();
      expect(validationEngine.isInitialized).toBe(false);
      expect(validationEngine.validationResults).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await validationEngine.initialize();
      
      expect(validationEngine.isInitialized).toBe(true);
      expect(validationEngine.e2eRunner).toBeDefined();
      expect(validationEngine.performanceBenchmark).toBeDefined();
      expect(validationEngine.visualTester).toBeDefined();
    });

    test('should load validation rules', async () => {
      await validationEngine.initialize();
      
      expect(validationEngine.validationRules).toBeDefined();
      expect(validationEngine.validationRules.seo).toBeDefined();
      expect(validationEngine.validationRules.performance).toBeDefined();
      expect(validationEngine.validationRules.accessibility).toBeDefined();
    });
  });

  describe('SEO Validation', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate meta tags', async () => {
      const result = await validationEngine.validateMetaTags('/seo-page');
      
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.ogTags).toBeDefined();
      expect(result.twitterCards).toBeDefined();
    });

    test('should check canonical URLs', async () => {
      const result = await validationEngine.checkCanonicalURL('/page');
      
      expect(result).toBeDefined();
      expect(result.hasCanonical).toBeDefined();
      expect(result.canonicalURL).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    test('should validate structured data', async () => {
      const result = await validationEngine.validateStructuredData('/product-page');
      
      expect(result).toBeDefined();
      expect(result.schemas).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should analyze robots directives', async () => {
      const result = await validationEngine.analyzeRobotsDirectives('/page');
      
      expect(result).toBeDefined();
      expect(result.metaRobots).toBeDefined();
      expect(result.robotsTxt).toBeDefined();
      expect(result.isIndexable).toBeDefined();
    });

    test('should generate sitemap validation', async () => {
      const result = await validationEngine.validateSitemap('/sitemap.xml');
      
      expect(result).toBeDefined();
      expect(result.urlCount).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should analyze critical CSS', async () => {
      const result = await validationEngine.analyzeCriticalCSS('/page');
      
      expect(result).toBeDefined();
      expect(result.criticalCSS).toBeDefined();
      expect(result.unusedCSS).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should detect unused JavaScript', async () => {
      const result = await validationEngine.detectUnusedJavaScript('/page');
      
      expect(result).toBeDefined();
      expect(result.totalSize).toBeDefined();
      expect(result.unusedSize).toBeDefined();
      expect(result.unusedPercentage).toBeDefined();
      expect(result.files).toBeDefined();
    });

    test('should analyze resource hints', async () => {
      const result = await validationEngine.analyzeResourceHints('/page');
      
      expect(result).toBeDefined();
      expect(result.preload).toBeDefined();
      expect(result.prefetch).toBeDefined();
      expect(result.preconnect).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should validate caching headers', async () => {
      const result = await validationEngine.validateCachingHeaders('/page');
      
      expect(result).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(result.missingHeaders).toBeDefined();
      expect(result.improperHeaders).toBeDefined();
    });

    test('should check compression', async () => {
      const result = await validationEngine.checkCompression('/page');
      
      expect(result).toBeDefined();
      expect(result.compressedResources).toBeDefined();
      expect(result.uncompressedResources).toBeDefined();
      expect(result.potentialSavings).toBeDefined();
    });
  });

  describe('Security Validation', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate security headers', async () => {
      const result = await validationEngine.validateSecurityHeaders('/page');
      
      expect(result).toBeDefined();
      expect(result.headers).toBeDefined();
      expect(result.missing).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should check HTTPS usage', async () => {
      const result = await validationEngine.checkHTTPSUsage('/page');
      
      expect(result).toBeDefined();
      expect(result.protocol).toBeDefined();
      expect(result.mixedContent).toBeDefined();
      expect(result.insecureResources).toBeDefined();
    });

    test('should validate CSP policy', async () => {
      const result = await validationEngine.validateCSP('/page');
      
      expect(result).toBeDefined();
      expect(result.hasCSP).toBeDefined();
      expect(result.directives).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Cross-Browser Compatibility', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate browser compatibility', async () => {
      const result = await validationEngine.validateBrowserCompatibility('/page');
      
      expect(result).toBeDefined();
      expect(result.cssCompatibility).toBeDefined();
      expect(result.jsCompatibility).toBeDefined();
      expect(result.apiCompatibility).toBeDefined();
      expect(result.unsupportedFeatures).toBeDefined();
    });

    test('should detect vendor prefixes', async () => {
      const result = await validationEngine.detectVendorPrefixes('/page');
      
      expect(result).toBeDefined();
      expect(result.prefixedProperties).toBeDefined();
      expect(result.unnecessaryPrefixes).toBeDefined();
      expect(result.missingPrefixes).toBeDefined();
    });

    test('should check polyfill requirements', async () => {
      const result = await validationEngine.checkPolyfillRequirements('/page');
      
      expect(result).toBeDefined();
      expect(result.requiredPolyfills).toBeDefined();
      expect(result.includedPolyfills).toBeDefined();
      expect(result.unnecessaryPolyfills).toBeDefined();
    });
  });

  describe('Mobile Optimization', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate mobile viewport', async () => {
      const result = await validationEngine.validateMobileViewport('/page');
      
      expect(result).toBeDefined();
      expect(result.hasViewport).toBeDefined();
      expect(result.viewportContent).toBeDefined();
      expect(result.isMobileOptimized).toBeDefined();
    });

    test('should check touch targets', async () => {
      const result = await validationEngine.checkTouchTargets('/page');
      
      expect(result).toBeDefined();
      expect(result.totalTargets).toBeDefined();
      expect(result.smallTargets).toBeDefined();
      expect(result.overlappingTargets).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should analyze mobile performance', async () => {
      const result = await validationEngine.analyzeMobilePerformance('/page');
      
      expect(result).toBeDefined();
      expect(result.loadTime).toBeDefined();
      expect(result.interactiveTime).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Content Validation', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate HTML structure', async () => {
      const result = await validationEngine.validateHTMLStructure('/page');
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.doctype).toBeDefined();
      expect(result.encoding).toBeDefined();
    });

    test('should check broken links', async () => {
      const result = await validationEngine.checkBrokenLinks('/page');
      
      expect(result).toBeDefined();
      expect(result.totalLinks).toBeDefined();
      expect(result.brokenLinks).toBeDefined();
      expect(result.redirects).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should validate forms', async () => {
      const result = await validationEngine.validateForms('/page');
      
      expect(result).toBeDefined();
      expect(result.forms).toBeDefined();
      expect(result.missingLabels).toBeDefined();
      expect(result.missingValidation).toBeDefined();
      expect(result.accessibilityIssues).toBeDefined();
    });
  });

  describe('PWA Validation', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate PWA manifest', async () => {
      const result = await validationEngine.validatePWAManifest('/page');
      
      expect(result).toBeDefined();
      expect(result.hasManifest).toBeDefined();
      expect(result.requiredFields).toBeDefined();
      expect(result.icons).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should check service worker', async () => {
      const result = await validationEngine.checkServiceWorker('/page');
      
      expect(result).toBeDefined();
      expect(result.hasServiceWorker).toBeDefined();
      expect(result.scope).toBeDefined();
      expect(result.cacheStrategies).toBeDefined();
      expect(result.offlineCapability).toBeDefined();
    });

    test('should validate installability', async () => {
      const result = await validationEngine.validateInstallability('/page');
      
      expect(result).toBeDefined();
      expect(result.isInstallable).toBeDefined();
      expect(result.missingCriteria).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Internationalization', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should validate language attributes', async () => {
      const result = await validationEngine.validateLanguageAttributes('/page');
      
      expect(result).toBeDefined();
      expect(result.htmlLang).toBeDefined();
      expect(result.contentLanguage).toBeDefined();
      expect(result.hreflangTags).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should check text direction', async () => {
      const result = await validationEngine.checkTextDirection('/page');
      
      expect(result).toBeDefined();
      expect(result.defaultDirection).toBeDefined();
      expect(result.mixedDirection).toBeDefined();
      expect(result.rtlSupport).toBeDefined();
    });
  });

  describe('Comprehensive Validation', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should run full frontend validation', async () => {
      const result = await validationEngine.runFullValidation('/page');
      
      expect(result).toBeDefined();
      expect(result.seo).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.security).toBeDefined();
      expect(result.accessibility).toBeDefined();
      expect(result.compatibility).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });

    test('should generate validation report', async () => {
      await validationEngine.runFullValidation('/page');
      const report = await validationEngine.generateValidationReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    test('should export validation results', async () => {
      await validationEngine.runFullValidation('/page');
      const exported = await validationEngine.exportResults('json');
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.validations).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await validationEngine.initialize();
    });

    test('should handle validation failures gracefully', async () => {
      const result = await validationEngine.runFullValidation('/non-existent');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('should handle network failures', async () => {
      const result = await validationEngine.checkBrokenLinks('/offline-page');
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await validationEngine.initialize();
      
      // Run some validations
      await validationEngine.runFullValidation('/page');
      
      expect(validationEngine.validationResults.size).toBeGreaterThan(0);
      
      await validationEngine.cleanup();
      
      expect(validationEngine.validationResults.size).toBe(0);
      expect(validationEngine.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample pages for validation testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.html'),
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Test page for frontend validation">
  <meta property="og:title" content="Test Page">
  <meta property="og:description" content="A test page for validation">
  <title>Validation Test Page</title>
  <link rel="canonical" href="https://example.com/page">
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="styles.css">
  <script src="app.js" defer></script>
</head>
<body>
  <header>
    <h1>Frontend Validation Test</h1>
    <nav>
      <a href="/home" class="nav-link">Home</a>
      <a href="/about" class="nav-link">About</a>
      <a href="/contact" class="nav-link">Contact</a>
    </nav>
  </header>
  
  <main>
    <form id="contact-form">
      <label for="email">Email:</label>
      <input type="email" id="email" name="email" required>
      
      <label for="message">Message:</label>
      <textarea id="message" name="message" required></textarea>
      
      <button type="submit">Submit</button>
    </form>
    
    <section>
      <h2>Content Section</h2>
      <p>Test content for validation</p>
      <img src="test.jpg" alt="Test image">
    </section>
  </main>
  
  <footer>
    <p>&copy; 2024 Test Site</p>
  </footer>
  
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Test Page",
    "description": "A test page for validation"
  }
  </script>
</body>
</html>
`
  );
  
  // Create manifest.json
  await fs.writeFile(
    path.join(projectPath, 'src', 'manifest.json'),
    JSON.stringify({
      name: 'Test App',
      short_name: 'Test',
      start_url: '/',
      display: 'standalone',
      theme_color: '#000000',
      background_color: '#ffffff',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }, null, 2)
  );
  
  // Create sitemap.xml
  await fs.writeFile(
    path.join(projectPath, 'src', 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`
  );
}