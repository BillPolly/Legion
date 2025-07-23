/**
 * BrowserTestingPhase - Handles browser automation and testing
 * 
 * Integrates with @legion/playwright package to provide browser automation
 * capabilities for the code agent workflow.
 */

import PlaywrightWrapper from '@legion/playwright';

class BrowserTestingPhase {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
    
    // Initialize Playwright wrapper with configuration
    this.browser = new PlaywrightWrapper({
      browserType: codeAgent.config.browser?.browserType || 'chromium',
      headless: codeAgent.config.browser?.headless !== false, // Default to true
      timeout: codeAgent.config.browser?.timeout || 30000,
      retries: codeAgent.config.browser?.retries || 3,
      ...codeAgent.config.browser
    });
    
    // Test results storage
    this.testResults = [];
    this.screenshots = [];
    this.extractedData = [];
    this.logs = [];
    
    // Test session info
    this.sessionStarted = null;
    this.currentTestSuite = null;
  }

  /**
   * Start a browser testing session
   * @returns {Promise<void>}
   */
  async startSession() {
    this.codeAgent.emit('phase-start', {
      phase: 'browser-testing',
      message: 'Starting browser testing session',
      emoji: '🌐'
    });

    try {
      this.sessionStarted = new Date();
      
      this.codeAgent.emit('info', { 
        message: 'Browser testing session initialized' 
      });

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Failed to start browser session: ${error.message}`,
        error
      });
      throw error;
    }
  }

  /**
   * Navigate to a URL and validate basic page properties
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   * @returns {Promise<Object>} - Navigation result
   */
  async navigateAndValidate(url, options = {}) {
    this.codeAgent.emit('info', { 
      message: `Navigating to: ${url}` 
    });

    try {
      const result = await this.browser.navigateToPage(url, options);
      
      if (result.success) {
        // Get additional page info
        const pageInfo = await this.browser.getPageInfo();
        
        // Combine results
        const combinedResult = {
          ...result,
          pageInfo: pageInfo.success ? pageInfo : null,
          timestamp: new Date().toISOString()
        };
        
        this.logs.push({
          type: 'navigation',
          action: 'navigate',
          url,
          success: true,
          result: combinedResult,
          timestamp: new Date().toISOString()
        });
        
        return combinedResult;
      } else {
        throw new Error(result.error || 'Navigation failed');
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        url,
        timestamp: new Date().toISOString()
      };
      
      this.logs.push({
        type: 'navigation',
        action: 'navigate',
        url,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      this.codeAgent.emit('error', {
        message: `Navigation failed: ${error.message}`,
        url,
        error
      });
      
      return errorResult;
    }
  }

  /**
   * Execute JavaScript in the browser context
   * @param {string|Function} script - JavaScript code or function to execute
   * @param {Array} args - Arguments to pass to the script
   * @returns {Promise<Object>} - Execution result
   */
  async executeJavaScript(script, args = []) {
    try {
      const scriptString = typeof script === 'function' ? script.toString() : script;
      const result = await this.browser.executeScript(scriptString, args);
      
      this.logs.push({
        type: 'javascript',
        action: 'execute',
        script: scriptString.substring(0, 100) + (scriptString.length > 100 ? '...' : ''),
        success: result.success,
        result: result.success ? result.result : result.error,
        timestamp: new Date().toISOString()
      });
      
      if (result.success) {
        this.codeAgent.emit('info', {
          message: 'JavaScript executed successfully'
        });
      } else {
        this.codeAgent.emit('warning', {
          message: `JavaScript execution failed: ${result.error}`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Script execution error: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Take a screenshot of the current page or specific element
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} - Screenshot result
   */
  async captureScreenshot(options = {}) {
    try {
      const result = await this.browser.takeScreenshot(options);
      
      if (result.success) {
        this.screenshots.push({
          timestamp: result.timestamp,
          format: result.format,
          selector: result.selector,
          fullPage: result.fullPage,
          size: result.screenshot.length
        });

        this.codeAgent.emit('info', {
          message: `Screenshot captured${options.selector ? ` of element: ${options.selector}` : ''}`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Screenshot failed: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extract structured data from the current page
   * @param {Object} selectors - Map of key-selector pairs for data extraction
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} - Extracted data
   */
  async extractPageData(selectors, options = {}) {
    try {
      const result = await this.browser.extractData(selectors, options);
      
      if (result.success) {
        this.extractedData.push({
          ...result,
          selectors,
          extractedAt: result.extractedAt
        });

        this.codeAgent.emit('info', {
          message: `Extracted data for ${Object.keys(selectors).length} elements`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Data extraction failed: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Wait for an element to appear or change state
   * @param {string} selector - CSS selector to wait for
   * @param {Object} options - Wait options
   * @returns {Promise<Object>} - Wait result
   */
  async waitForElement(selector, options = {}) {
    try {
      const result = await this.browser.waitForElement(selector, options);
      
      if (result.success) {
        this.codeAgent.emit('info', {
          message: `Element found: ${selector}`
        });
      } else {
        this.codeAgent.emit('warning', {
          message: `Element not found within timeout: ${selector}`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Wait for element failed: ${error.message}`,
        selector,
        error
      });
      
      return {
        success: false,
        error: error.message,
        selector,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Click on an element
   * @param {string} selector - CSS selector of element to click
   * @param {Object} options - Click options
   * @returns {Promise<Object>} - Click result
   */
  async clickElement(selector, options = {}) {
    try {
      const result = await this.browser.clickElement(selector, options);
      
      if (result.success) {
        this.codeAgent.emit('info', {
          message: `Clicked element: ${selector}`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Click failed: ${error.message}`,
        selector,
        error
      });
      
      return {
        success: false,
        error: error.message,
        selector,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fill form fields with data
   * @param {Object} formData - Map of selector-value pairs
   * @param {Object} options - Form filling options
   * @returns {Promise<Object>} - Form fill result
   */
  async fillForm(formData, options = {}) {
    try {
      const result = await this.browser.fillForm(formData, options);
      
      if (result.success) {
        this.codeAgent.emit('info', {
          message: `Filled ${result.fieldsProcessed} form fields`
        });
      }
      
      return result;

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Form fill failed: ${error.message}`,
        error
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run a comprehensive test suite on a web page
   * @param {string} url - URL to test
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<Object>} - Test suite results
   */
  async runPageTestSuite(url, testConfig = {}) {
    this.currentTestSuite = {
      url,
      startTime: new Date(),
      tests: []
    };

    const {
      takeScreenshot = true,
      extractData = true,
      runAccessibilityTests = true,
      runPerformanceTests = true,
      customTests = []
    } = testConfig;

    this.codeAgent.emit('info', {
      message: `Running test suite for: ${url}`
    });

    const results = {
      url,
      success: true,
      tests: {},
      errors: [],
      startTime: this.currentTestSuite.startTime,
      endTime: null
    };

    try {
      // 1. Navigate to page
      const navResult = await this.navigateAndValidate(url);
      results.tests.navigation = navResult;
      
      if (!navResult.success) {
        results.success = false;
        results.errors.push(`Navigation failed: ${navResult.error}`);
        return results;
      }

      // 2. Take screenshot if requested
      if (takeScreenshot) {
        const screenshotResult = await this.captureScreenshot({ 
          fullPage: true 
        });
        results.tests.screenshot = screenshotResult;
      }

      // 3. Extract basic page data if requested
      if (extractData) {
        const basicSelectors = {
          title: 'title',
          headings: 'h1, h2, h3',
          links: 'a[href]',
          images: 'img[src]',
          forms: 'form'
        };
        
        const dataResult = await this.extractPageData(basicSelectors, { 
          multiple: true 
        });
        results.tests.dataExtraction = dataResult;
      }

      // 4. Run accessibility tests if requested
      if (runAccessibilityTests) {
        const a11yResult = await this._runBasicAccessibilityTests();
        results.tests.accessibility = a11yResult;
      }

      // 5. Run performance tests if requested
      if (runPerformanceTests) {
        const perfResult = await this._runBasicPerformanceTests();
        results.tests.performance = perfResult;
      }

      // 6. Run custom tests
      for (const customTest of customTests) {
        try {
          const customResult = await this._runCustomTest(customTest);
          results.tests[customTest.name] = customResult;
        } catch (error) {
          results.errors.push(`Custom test '${customTest.name}' failed: ${error.message}`);
        }
      }

    } catch (error) {
      results.success = false;
      results.errors.push(`Test suite error: ${error.message}`);
      
      this.codeAgent.emit('error', {
        message: `Test suite failed: ${error.message}`,
        url,
        error
      });
    }

    results.endTime = new Date();
    results.duration = results.endTime - results.startTime;
    
    this.testResults.push(results);
    this.currentTestSuite = null;

    this.codeAgent.emit('info', {
      message: `Test suite completed for ${url} - ${results.success ? 'PASSED' : 'FAILED'}`
    });

    return results;
  }

  /**
   * Run basic accessibility tests
   * @private
   */
  async _runBasicAccessibilityTests() {
    const accessibilityScript = () => {
      const results = {
        hasAltText: true,
        hasHeadingStructure: true,
        hasFormLabels: true,
        issues: []
      };

      // Check images for alt text
      const images = document.querySelectorAll('img');
      images.forEach((img, i) => {
        if (!img.alt) {
          results.hasAltText = false;
          results.issues.push(`Image ${i + 1} missing alt text`);
        }
      });

      // Check heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let hasH1 = false;
      headings.forEach(h => {
        if (h.tagName === 'H1') hasH1 = true;
      });
      if (headings.length > 0 && !hasH1) {
        results.hasHeadingStructure = false;
        results.issues.push('No H1 heading found');
      }

      // Check form labels
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
      inputs.forEach((input, i) => {
        const label = document.querySelector(`label[for="${input.id}"]`) || input.closest('label');
        if (!label) {
          results.hasFormLabels = false;
          results.issues.push(`Input field ${i + 1} missing label`);
        }
      });

      return results;
    };

    return await this.executeJavaScript(accessibilityScript);
  }

  /**
   * Run basic performance tests
   * @private
   */
  async _runBasicPerformanceTests() {
    const performanceScript = () => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart : null,
        loadComplete: nav ? nav.loadEventEnd - nav.loadEventStart : null,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || null,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null,
        resourceCount: performance.getEntriesByType('resource').length
      };
    };

    return await this.executeJavaScript(performanceScript);
  }

  /**
   * Run custom test
   * @private
   */
  async _runCustomTest(testConfig) {
    const { name, script, selector, expectedValue } = testConfig;
    
    if (script) {
      return await this.executeJavaScript(script);
    }
    
    if (selector) {
      const waitResult = await this.waitForElement(selector, { timeout: 5000 });
      if (expectedValue && waitResult.success) {
        return {
          ...waitResult,
          expectedValue,
          matches: waitResult.text === expectedValue
        };
      }
      return waitResult;
    }
    
    throw new Error(`Invalid custom test configuration for test: ${name}`);
  }

  /**
   * Get all test results
   * @returns {Array} - Array of test results
   */
  getTestResults() {
    return [...this.testResults];
  }

  /**
   * Get all screenshots taken
   * @returns {Array} - Array of screenshot metadata
   */
  getScreenshots() {
    return [...this.screenshots];
  }

  /**
   * Get all extracted data
   * @returns {Array} - Array of extracted data
   */
  getExtractedData() {
    return [...this.extractedData];
  }

  /**
   * Get browser logs
   * @returns {Array} - Array of browser operation logs
   */
  getBrowserLogs() {
    return [...this.logs];
  }

  /**
   * Generate comprehensive testing report
   * @returns {Object} - Testing report
   */
  generateTestingReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    return {
      summary: {
        sessionStarted: this.sessionStarted,
        totalTests,
        passedTests,
        failedTests,
        successRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) + '%' : '0%',
        screenshotsTaken: this.screenshots.length,
        dataExtractions: this.extractedData.length,
        operationsLogged: this.logs.length
      },
      testResults: this.testResults,
      screenshots: this.screenshots,
      extractedData: this.extractedData,
      logs: this.logs,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Cleanup browser resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.codeAgent.emit('info', {
      message: 'Cleaning up browser testing resources'
    });

    try {
      await this.browser.close();
      
      this.codeAgent.emit('info', {
        message: 'Browser testing cleanup completed'
      });

    } catch (error) {
      this.codeAgent.emit('error', {
        message: `Browser cleanup failed: ${error.message}`,
        error
      });
    }
  }
}

export { BrowserTestingPhase };