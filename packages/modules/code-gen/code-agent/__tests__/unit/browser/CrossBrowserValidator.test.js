/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { CrossBrowserValidator } from '../../../src/browser/CrossBrowserValidator.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CrossBrowserValidator', () => {
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
        browsers: ['chromium', 'firefox', 'webkit'],
        baseURL: 'http://localhost:3000'
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-cross-browser-project');
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
    validator = new CrossBrowserValidator(mockConfig);
  });

    afterEach(async () => {
    if (validator) {
      try {
        await validator.cleanup();
      } catch (error) {
        console.warn('Cleanup error (ignored):', error.message);
      }
      validator = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(validator.config).toBeDefined();
      expect(validator.isInitialized).toBe(false);
      expect(validator.browsers).toEqual(['chromium', 'firefox', 'webkit']);
    });

    test('should initialize successfully', async () => {
      await validator.initialize();
      
      expect(validator.isInitialized).toBe(true);
      expect(validator.e2eRunner).toBeDefined();
      expect(validator.visualTester).toBeDefined();
    });

    test('should load browser compatibility data', async () => {
      await validator.initialize();
      
      expect(validator.compatibilityData).toBeDefined();
      expect(validator.compatibilityData.css).toBeDefined();
      expect(validator.compatibilityData.javascript).toBeDefined();
      expect(validator.compatibilityData.apis).toBeDefined();
    });
  });

  describe('Cross-Browser Testing', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should run tests across all browsers', async () => {
      const result = await validator.runCrossBrowserTests('/test-page', {
        tests: ['rendering', 'interaction', 'performance']
      });
      
      expect(result).toBeDefined();
      expect(result.browsers).toHaveLength(3);
      expect(result.browsers[0].browser).toBe('chromium');
      expect(result.browsers[1].browser).toBe('firefox');
      expect(result.browsers[2].browser).toBe('webkit');
      expect(result.summary).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should detect browser-specific issues', async () => {
      const result = await validator.detectBrowserSpecificIssues('/page');
      
      expect(result).toBeDefined();
      expect(result.chromium).toBeDefined();
      expect(result.firefox).toBeDefined();
      expect(result.webkit).toBeDefined();
      expect(result.common).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should compare rendering across browsers', async () => {
      const result = await validator.compareRendering('/page');
      
      expect(result).toBeDefined();
      expect(result.visualDifferences).toBeDefined();
      expect(result.layoutDifferences).toBeDefined();
      expect(result.consistent).toBeDefined();
      expect(result.screenshots).toBeDefined();
    });

    test('should test JavaScript compatibility', async () => {
      const result = await validator.testJavaScriptCompatibility('/page');
      
      expect(result).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.polyfillsNeeded).toBeDefined();
    });

    test('should test CSS compatibility', async () => {
      const result = await validator.testCSSCompatibility('/page');
      
      expect(result).toBeDefined();
      expect(result.properties).toBeDefined();
      expect(result.unsupported).toBeDefined();
      expect(result.prefixesNeeded).toBeDefined();
      expect(result.fallbacks).toBeDefined();
    });
  });

  describe('Feature Detection', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should detect HTML5 features', async () => {
      const result = await validator.detectHTML5Features('/page');
      
      expect(result).toBeDefined();
      expect(result.canvas).toBeDefined();
      expect(result.video).toBeDefined();
      expect(result.audio).toBeDefined();
      expect(result.webGL).toBeDefined();
      expect(result.localStorage).toBeDefined();
      expect(result.webWorkers).toBeDefined();
    });

    test('should detect CSS3 features', async () => {
      const result = await validator.detectCSS3Features('/page');
      
      expect(result).toBeDefined();
      expect(result.flexbox).toBeDefined();
      expect(result.grid).toBeDefined();
      expect(result.transforms).toBeDefined();
      expect(result.animations).toBeDefined();
      expect(result.customProperties).toBeDefined();
    });

    test('should detect JavaScript APIs', async () => {
      const result = await validator.detectJavaScriptAPIs('/page');
      
      expect(result).toBeDefined();
      expect(result.promise).toBeDefined();
      expect(result.fetch).toBeDefined();
      expect(result.intersectionObserver).toBeDefined();
      expect(result.webComponents).toBeDefined();
      expect(result.serviceWorker).toBeDefined();
    });

    test('should detect modern features', async () => {
      const result = await validator.detectModernFeatures('/page');
      
      expect(result).toBeDefined();
      expect(result.es6).toBeDefined();
      expect(result.es2020).toBeDefined();
      expect(result.webAssembly).toBeDefined();
      expect(result.modules).toBeDefined();
    });
  });

  describe('Functionality Testing', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should test form functionality', async () => {
      const result = await validator.testFormFunctionality('/form-page');
      
      expect(result).toBeDefined();
      expect(result.browsers).toHaveLength(3);
      expect(result.validation).toBeDefined();
      expect(result.submission).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    test('should test interactive elements', async () => {
      const result = await validator.testInteractiveElements('/page');
      
      expect(result).toBeDefined();
      expect(result.buttons).toBeDefined();
      expect(result.dropdowns).toBeDefined();
      expect(result.modals).toBeDefined();
      expect(result.tooltips).toBeDefined();
    });

    test('should test media playback', async () => {
      const result = await validator.testMediaPlayback('/media-page');
      
      expect(result).toBeDefined();
      expect(result.video).toBeDefined();
      expect(result.audio).toBeDefined();
      expect(result.streaming).toBeDefined();
      expect(result.formats).toBeDefined();
    });

    test('should test animations', async () => {
      const result = await validator.testAnimations('/animated-page');
      
      expect(result).toBeDefined();
      expect(result.cssAnimations).toBeDefined();
      expect(result.jsAnimations).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.smoothness).toBeDefined();
    });
  });

  describe('Performance Comparison', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should compare load times', async () => {
      const result = await validator.compareLoadTimes('/page');
      
      expect(result).toBeDefined();
      expect(result.chromium).toBeDefined();
      expect(result.firefox).toBeDefined();
      expect(result.webkit).toBeDefined();
      expect(result.fastest).toBeDefined();
      expect(result.slowest).toBeDefined();
    });

    test('should compare memory usage', async () => {
      const result = await validator.compareMemoryUsage('/page');
      
      expect(result).toBeDefined();
      expect(result.browsers).toBeDefined();
      expect(result.lowestUsage).toBeDefined();
      expect(result.highestUsage).toBeDefined();
    });

    test('should compare JavaScript execution', async () => {
      const result = await validator.compareJavaScriptExecution('/page');
      
      expect(result).toBeDefined();
      expect(result.benchmarks).toBeDefined();
      expect(result.fastest).toBeDefined();
      expect(result.analysis).toBeDefined();
    });
  });

  describe('Accessibility Testing', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should test screen reader compatibility', async () => {
      const result = await validator.testScreenReaderCompatibility('/page');
      
      expect(result).toBeDefined();
      expect(result.ariaSupport).toBeDefined();
      expect(result.landmarks).toBeDefined();
      expect(result.announcements).toBeDefined();
      expect(result.navigation).toBeDefined();
    });

    test('should test keyboard navigation', async () => {
      const result = await validator.testKeyboardNavigation('/page');
      
      expect(result).toBeDefined();
      expect(result.tabOrder).toBeDefined();
      expect(result.focusManagement).toBeDefined();
      expect(result.shortcuts).toBeDefined();
      expect(result.traps).toBeDefined();
    });

    test('should test color contrast', async () => {
      const result = await validator.testColorContrast('/page');
      
      expect(result).toBeDefined();
      expect(result.textContrast).toBeDefined();
      expect(result.uiContrast).toBeDefined();
      expect(result.failures).toBeDefined();
    });
  });

  describe('Mobile Browser Testing', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should test mobile viewports', async () => {
      const result = await validator.testMobileViewports('/page');
      
      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(result.orientations).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    test('should test touch interactions', async () => {
      const result = await validator.testTouchInteractions('/page');
      
      expect(result).toBeDefined();
      expect(result.gestures).toBeDefined();
      expect(result.touchTargets).toBeDefined();
      expect(result.scrolling).toBeDefined();
    });

    test('should test mobile-specific features', async () => {
      const result = await validator.testMobileFeatures('/page');
      
      expect(result).toBeDefined();
      expect(result.geolocation).toBeDefined();
      expect(result.camera).toBeDefined();
      expect(result.deviceOrientation).toBeDefined();
    });
  });

  describe('Progressive Enhancement', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should test JavaScript disabled', async () => {
      const result = await validator.testWithoutJavaScript('/page');
      
      expect(result).toBeDefined();
      expect(result.functionality).toBeDefined();
      expect(result.accessibility).toBeDefined();
      expect(result.fallbacks).toBeDefined();
    });

    test('should test CSS disabled', async () => {
      const result = await validator.testWithoutCSS('/page');
      
      expect(result).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.readability).toBeDefined();
      expect(result.navigation).toBeDefined();
    });

    test('should test feature fallbacks', async () => {
      const result = await validator.testFeatureFallbacks('/page');
      
      expect(result).toBeDefined();
      expect(result.polyfills).toBeDefined();
      expect(result.gracefulDegradation).toBeDefined();
      expect(result.coreExperience).toBeDefined();
    });
  });

  describe('Compatibility Reports', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should generate compatibility matrix', async () => {
      await validator.runCrossBrowserTests('/page');
      const matrix = await validator.generateCompatibilityMatrix();
      
      expect(matrix).toBeDefined();
      expect(matrix.features).toBeDefined();
      expect(matrix.browsers).toBeDefined();
      expect(matrix.support).toBeDefined();
    });

    test('should generate browser-specific recommendations', async () => {
      await validator.runCrossBrowserTests('/page');
      const recommendations = await validator.generateRecommendations();
      
      expect(recommendations).toBeDefined();
      expect(recommendations.critical).toBeDefined();
      expect(recommendations.important).toBeDefined();
      expect(recommendations.nice).toBeDefined();
    });

    test('should export compatibility report', async () => {
      await validator.runCrossBrowserTests('/page');
      const report = await validator.exportReport('json');
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      const parsed = JSON.parse(report);
      expect(parsed.results).toBeDefined();
    });
  });

  describe('Automated Fixes', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should suggest CSS prefixes', async () => {
      const suggestions = await validator.suggestCSSPrefixes('/page');
      
      expect(suggestions).toBeDefined();
      expect(suggestions.prefixes).toBeDefined();
      expect(suggestions.code).toBeDefined();
    });

    test('should suggest polyfills', async () => {
      const suggestions = await validator.suggestPolyfills('/page');
      
      expect(suggestions).toBeDefined();
      expect(suggestions.required).toBeDefined();
      expect(suggestions.optional).toBeDefined();
      expect(suggestions.implementation).toBeDefined();
    });

    test('should generate fallback code', async () => {
      const fallbacks = await validator.generateFallbacks('/page');
      
      expect(fallbacks).toBeDefined();
      expect(fallbacks.css).toBeDefined();
      expect(fallbacks.javascript).toBeDefined();
      expect(fallbacks.html).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await validator.initialize();
    });

    test('should handle browser launch failures', async () => {
      const result = await validator.runCrossBrowserTests('/page', {
        browsers: ['invalid-browser']
      });
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    test('should handle test timeouts', async () => {
      const result = await validator.runCrossBrowserTests('/timeout-page', {
        timeout: 100
      });
      
      expect(result).toBeDefined();
      expect(result.errors || result.summary).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await validator.initialize();
      
      // Run some tests
      await validator.runCrossBrowserTests('/page');
      
      expect(validator.testResults.size).toBeGreaterThan(0);
      
      await validator.cleanup();
      
      expect(validator.testResults.size).toBe(0);
      expect(validator.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample pages for cross-browser testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.html'),
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cross-Browser Test Page</title>
  <style>
    /* Modern CSS features */
    :root {
      --primary-color: #007bff;
    }
    
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      padding: 20px;
    }
    
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 20px;
      transform: translateY(0);
      transition: transform 0.3s ease;
    }
    
    .card:hover {
      transform: translateY(-5px);
    }
    
    @supports (display: flex) {
      .flex-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Cross-Browser Testing</h1>
    <nav>
      <a href="#features">Features</a>
      <a href="#forms">Forms</a>
      <a href="#media">Media</a>
    </nav>
  </header>
  
  <main class="container">
    <section class="card" id="features">
      <h2>Modern Features</h2>
      <div class="flex-container">
        <canvas id="canvas" width="200" height="100"></canvas>
        <button onclick="testFeature()">Test Feature</button>
      </div>
    </section>
    
    <section class="card" id="forms">
      <h2>Form Elements</h2>
      <form>
        <input type="email" placeholder="Email" required>
        <input type="date" placeholder="Date">
        <input type="range" min="0" max="100">
        <select>
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
        <button type="submit">Submit</button>
      </form>
    </section>
    
    <section class="card" id="media">
      <h2>Media Content</h2>
      <video controls width="100%">
        <source src="video.mp4" type="video/mp4">
        <source src="video.webm" type="video/webm">
        Your browser doesn't support video.
      </video>
      
      <audio controls>
        <source src="audio.mp3" type="audio/mpeg">
        <source src="audio.ogg" type="audio/ogg">
        Your browser doesn't support audio.
      </audio>
    </section>
  </main>
  
  <script>
    // Modern JavaScript features
    const testFeature = async () => {
      try {
        // ES6+ features
        const { x, y } = { x: 1, y: 2 };
        const arr = [...[1, 2, 3]];
        const promise = Promise.resolve('test');
        
        // Optional chaining
        const obj = { a: { b: 'value' } };
        const value = obj?.a?.b;
        
        // Async/await
        const result = await promise;
        
        // Web APIs
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver(() => {});
        }
        
        // Canvas drawing
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'var(--primary-color)';
        ctx.fillRect(10, 10, 180, 80);
        
        console.log('All features supported!');
      } catch (error) {
        console.error('Feature not supported:', error);
      }
    };
    
    // Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  </script>
</body>
</html>
`
  );
  
  // Create form test page
  await fs.writeFile(
    path.join(projectPath, 'src', 'form-page.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Form Test Page</title>
</head>
<body>
  <form id="test-form">
    <input type="text" name="username" required>
    <input type="email" name="email" required>
    <input type="password" name="password" minlength="8">
    <input type="tel" name="phone" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}">
    <textarea name="message" required></textarea>
    <select name="country">
      <option value="">Select Country</option>
      <option value="us">United States</option>
      <option value="uk">United Kingdom</option>
    </select>
    <input type="checkbox" name="agree" required>
    <button type="submit">Submit</button>
  </form>
  
  <script>
    document.getElementById('test-form').addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Form submitted');
    });
  </script>
</body>
</html>
`
  );
}