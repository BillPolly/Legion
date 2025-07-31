import { BrowserManager } from './BrowserManager.js';
import { normalizeSelector, getElementWithFallback, waitForSelectorWithRetry } from './utils/selectors.js';
import { waitForNetworkIdle, waitForPageLoad, waitForElementStable, waitForCondition } from './utils/waits.js';
import { handlePlaywrightError, withRetry, safeOperation, validateParams, createErrorResponse } from './utils/errors.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Natural Playwright wrapper that provides browser automation capabilities
 */
export default class PlaywrightWrapper {
  constructor(config = {}) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      retries: 3,
      ...config
    };
    
    this.browserManager = new BrowserManager(this.config);
    this.isInitialized = false;
  }

  /**
   * Initialize the wrapper (called automatically when needed)
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      await this.browserManager.launchBrowser();
      await this.browserManager.createContext();
      await this.browserManager.createPage();
      this.isInitialized = true;
    } catch (error) {
      throw handlePlaywrightError(error, { action: 'initialize' });
    }
  }

  /**
   * Navigate to a web page
   */
  async navigateToPage(url, options = {}) {
    validateParams({ url }, ['url']);
    
    const {
      waitUntil = 'load',
      timeout = this.config.timeout,
      retries = this.config.retries
    } = options;
    
    return withRetry(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      const response = await page.goto(url, {
        waitUntil,
        timeout
      });
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }
      
      return {
        success: true,
        url: page.url(),
        title: await page.title(),
        status: response.status(),
        loadTime: Date.now() - response.request().timing().startTime
      };
    }, { retries, action: 'navigate', url });
  }

  /**
   * Click on an element
   */
  async clickElement(selector, options = {}) {
    validateParams({ selector }, ['selector']);
    
    const {
      clickType = 'single',
      waitForElement = true,
      timeout = this.config.timeout,
      retries = this.config.retries
    } = options;
    
    return withRetry(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      if (waitForElement) {
        await waitForSelectorWithRetry(page, selector, { timeout });
      }
      
      const element = await getElementWithFallback(page, selector);
      
      switch (clickType) {
        case 'double':
          await element.dblclick();
          break;
        case 'right':
          await element.click({ button: 'right' });
          break;
        case 'single':
        default:
          await element.click();
          break;
      }
      
      return {
        success: true,
        selector,
        clickType,
        elementText: await element.textContent() || null
      };
    }, { retries, action: 'click', selector });
  }

  /**
   * Fill out a form with provided data
   */
  async fillForm(formData, options = {}) {
    validateParams({ formData }, ['formData']);
    
    const {
      submitForm = false,
      clearFirst = true,
      timeout = this.config.timeout,
      retries = this.config.retries
    } = options;
    
    return withRetry(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      const results = {};
      
      for (const [fieldSelector, value] of Object.entries(formData)) {
        try {
          const element = await getElementWithFallback(page, fieldSelector);
          
          if (clearFirst) {
            await element.clear();
          }
          
          await element.fill(String(value));
          results[fieldSelector] = { success: true, value };
        } catch (error) {
          results[fieldSelector] = { 
            success: false, 
            error: error.message 
          };
        }
      }
      
      let submitResult = null;
      if (submitForm) {
        try {
          // Try to find and click submit button
          const submitButton = await getElementWithFallback(page, 'button[type="submit"], input[type="submit"], button:has-text("Submit")');
          await submitButton.click();
          
          // Wait for navigation or response
          await Promise.race([
            page.waitForNavigation({ timeout: 5000 }),
            waitForNetworkIdle(page, { timeout: 5000 })
          ]);
          
          submitResult = { success: true };
        } catch (error) {
          submitResult = { success: false, error: error.message };
        }
      }
      
      return {
        success: true,
        fieldsProcessed: Object.keys(formData).length,
        results,
        submitResult
      };
    }, { retries, action: 'fillForm' });
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(options = {}) {
    const {
      selector = null,
      fullPage = false,
      format = 'png',
      quality = 80,
      timeout = this.config.timeout,
      path: outputPath = null
    } = options;
    
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      let screenshotOptions = {
        type: format,
        fullPage,
        timeout
      };
      
      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }
      
      // If path is provided, save directly to file
      if (outputPath) {
        // Ensure the path has a filename
        let finalPath = outputPath;
        if (finalPath.endsWith('/') || finalPath.endsWith('\\')) {
          // Just a directory, add default filename
          finalPath = path.join(finalPath, `screenshot.${format}`);
        } else if (!path.extname(finalPath)) {
          // No extension, add one based on format
          finalPath = `${finalPath}.${format}`;
        }
        
        // Create directory if it doesn't exist
        const dir = path.dirname(finalPath);
        await fs.mkdir(dir, { recursive: true });
        
        screenshotOptions.path = finalPath;
      }
      
      let screenshot;
      if (selector) {
        const element = await getElementWithFallback(page, selector);
        screenshot = await element.screenshot(screenshotOptions);
      } else {
        screenshot = await page.screenshot(screenshotOptions);
      }
      
      return {
        success: true,
        screenshot: outputPath ? `Saved to ${screenshotOptions.path}` : screenshot.toString('base64'),
        format,
        selector,
        fullPage,
        timestamp: new Date().toISOString(),
        savedPath: outputPath ? screenshotOptions.path : null
      };
    }, { action: 'screenshot', selector });
  }

  /**
   * Extract structured data from the page
   */
  async extractData(selectors, options = {}) {
    validateParams({ selectors }, ['selectors']);
    
    const {
      multiple = false,
      timeout = this.config.timeout,
      waitForContent = true
    } = options;
    
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      if (waitForContent) {
        await waitForPageLoad(page);
      }
      
      const extractedData = {};
      
      for (const [key, selector] of Object.entries(selectors)) {
        try {
          const normalizedSelector = normalizeSelector(selector);
          
          if (multiple) {
            const elements = await page.locator(normalizedSelector).all();
            extractedData[key] = await Promise.all(
              elements.map(async (element) => {
                const text = await element.textContent();
                const html = await element.innerHTML();
                return { text: text?.trim(), html };
              })
            );
          } else {
            const element = page.locator(normalizedSelector).first();
            const text = await element.textContent();
            const html = await element.innerHTML();
            extractedData[key] = { text: text?.trim(), html };
          }
        } catch (error) {
          extractedData[key] = { 
            error: error.message, 
            selector 
          };
        }
      }
      
      return {
        success: true,
        data: extractedData,
        url: page.url(),
        extractedAt: new Date().toISOString()
      };
    }, { action: 'extractData' });
  }

  /**
   * Wait for an element to appear or change state
   */
  async waitForElement(selector, options = {}) {
    validateParams({ selector }, ['selector']);
    
    const {
      state = 'visible',
      timeout = this.config.timeout,
      stable = false
    } = options;
    
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      const normalizedSelector = normalizeSelector(selector);
      await page.waitForSelector(normalizedSelector, { state, timeout });
      
      if (stable) {
        await waitForElementStable(page, normalizedSelector, { timeout });
      }
      
      const element = page.locator(normalizedSelector);
      const isVisible = await element.isVisible();
      const text = await element.textContent();
      
      return {
        success: true,
        selector,
        state,
        isVisible,
        text: text?.trim(),
        waitTime: timeout
      };
    }, { action: 'waitForElement', selector });
  }

  /**
   * Execute JavaScript code in the browser
   */
  async executeScript(script, args = []) {
    validateParams({ script }, ['script']);
    
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      const result = await page.evaluate(script, args);
      
      return {
        success: true,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        script: script.substring(0, 100) + (script.length > 100 ? '...' : ''),
        executedAt: new Date().toISOString()
      };
    }, { action: 'executeScript' });
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(selector, filePath) {
    validateParams({ selector, filePath }, ['selector', 'filePath']);
    
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      const element = await getElementWithFallback(page, selector);
      await element.setInputFiles(filePath);
      
      return {
        success: true,
        selector,
        filePath,
        uploadedAt: new Date().toISOString()
      };
    }, { action: 'fileUpload', selector });
  }

  /**
   * Emulate mobile device
   */
  async emulateDevice(deviceName) {
    validateParams({ deviceName }, ['deviceName']);
    
    return safeOperation(async () => {
      const { devices } = await import('playwright');
      
      if (!devices[deviceName]) {
        throw new Error(`Device not found: ${deviceName}`);
      }
      
      this.browserManager.config.contextOptions = devices[deviceName];
      
      // If already initialized, create new context
      if (this.isInitialized) {
        await this.browserManager.closeContext();
        await this.browserManager.createContext();
        await this.browserManager.createPage();
      }
      
      return {
        success: true,
        deviceName,
        emulatedAt: new Date().toISOString()
      };
    }, { action: 'emulateDevice' });
  }

  /**
   * Close all browser resources
   */
  async close() {
    return safeOperation(async () => {
      await this.browserManager.closeAll();
      this.isInitialized = false;
      
      return {
        success: true,
        closedAt: new Date().toISOString()
      };
    }, { action: 'close' });
  }

  /**
   * Get current page information
   */
  async getPageInfo() {
    return safeOperation(async () => {
      await this.initialize();
      const page = await this.browserManager.getPage();
      
      return {
        success: true,
        url: page.url(),
        title: await page.title(),
        viewport: page.viewportSize(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        cookies: await page.context().cookies(),
        timestamp: new Date().toISOString()
      };
    }, { action: 'getPageInfo' });
  }
}