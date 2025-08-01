import { chromium, firefox, webkit } from 'playwright';

/**
 * Manages browser instances, contexts, and pages for Playwright automation
 */
export class BrowserManager {
  constructor(config = {}) {
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      ...config
    };
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Launch a browser instance
   */
  async launchBrowser() {
    if (this.browser) {
      return this.browser;
    }

    const browserType = this.getBrowserType();
    const launchOptions = {
      headless: this.config.headless,
      timeout: this.config.timeout,
      ...this.config.browserOptions
    };

    this.browser = await browserType.launch(launchOptions);
    return this.browser;
  }

  /**
   * Create a new browser context
   */
  async createContext(contextOptions = {}) {
    if (!this.browser) {
      await this.launchBrowser();
    }

    const options = {
      viewport: { width: 1280, height: 720 },
      ...this.config.contextOptions,
      ...contextOptions
    };

    this.context = await this.browser.newContext(options);
    return this.context;
  }

  /**
   * Create a new page
   */
  async createPage(pageOptions = {}) {
    if (!this.context) {
      await this.createContext();
    }

    this.page = await this.context.newPage();
    
    // Set default timeout
    this.page.setDefaultTimeout(this.config.timeout);
    
    return this.page;
  }

  /**
   * Get the current page, creating one if needed
   */
  async getPage() {
    if (!this.page) {
      await this.createPage();
    }
    return this.page;
  }

  /**
   * Get the current context, creating one if needed
   */
  async getContext() {
    if (!this.context) {
      await this.createContext();
    }
    return this.context;
  }

  /**
   * Get the current browser, launching one if needed
   */
  async getBrowser() {
    if (!this.browser) {
      await this.launchBrowser();
    }
    return this.browser;
  }

  /**
   * Get the browser type based on configuration
   */
  getBrowserType() {
    switch (this.config.browserType.toLowerCase()) {
      case 'firefox':
        return firefox;
      case 'webkit':
      case 'safari':
        return webkit;
      case 'chromium':
      case 'chrome':
      default:
        return chromium;
    }
  }

  /**
   * Close the current page
   */
  async closePage() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }

  /**
   * Close the current context
   */
  async closeContext() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  /**
   * Close the browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Close all browser resources
   */
  async closeAll() {
    await this.closePage();
    await this.closeContext();
    await this.closeBrowser();
  }

  /**
   * Set browser configuration
   */
  setBrowserType(browserType) {
    this.config.browserType = browserType;
  }

  /**
   * Set headless mode
   */
  setHeadless(headless) {
    this.config.headless = headless;
  }

  /**
   * Set default timeout
   */
  setTimeout(timeout) {
    this.config.timeout = timeout;
    if (this.page) {
      this.page.setDefaultTimeout(timeout);
    }
  }

  /**
   * Check if browser is ready
   */
  isReady() {
    return !!(this.browser && this.context && this.page);
  }
}