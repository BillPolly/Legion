import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

/**
 * PageScreenshot tool that captures screenshots of web pages
 * Pure logic implementation - metadata comes from module.json
 */
class PageScreenshotTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'screenshot';
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { url, fullPage = false, width = 1280, height = 720, waitForSelector } = params;
    
    // Emit progress event
    this.progress(`Starting screenshot capture: ${url}`, 0);
    
    // Take the screenshot
    const result = await this.screenshot(
      url,
      fullPage,
      width,
      height,
      waitForSelector
    );
    
    // Emit completion
    this.info(`Screenshot captured successfully for: ${url}`);
    
    return result;
  }

  /**
   * Takes a screenshot of a webpage
   */
  async screenshot(url, fullPage = false, width = 1280, height = 720, waitForSelector = null) {
    let browser = null;
    
    try {
      this.progress('Launching browser for screenshot', 25);
      
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set viewport size
      await page.setViewport({ width, height });
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      this.progress(`Navigating to ${url}`, 50);
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (!response.ok()) {
        this.warning(`Page returned status ${response.status()}`);
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        this.progress(`Waiting for selector: ${waitForSelector}`, 60);
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Wait a bit for any animations to complete
      this.progress('Waiting for animations to complete', 75);
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      this.progress('Capturing screenshot', 90);
      
      const screenshotBuffer = await page.screenshot({
        fullPage: fullPage,
        type: 'png',
        encoding: 'base64'
      });
      
      this.info('Screenshot captured');
      
      return {
        success: true,
        url: url,
        image: screenshotBuffer,
        isImage: true,
        mimeType: 'image/png',
        fullPage: fullPage,
        dimensions: {
          width: width,
          height: fullPage ? 'full' : height
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

/**
 * PageScreenshoterModule - metadata-driven architecture
 * Metadata comes from module.json, tools contain pure logic only
 */
export default class PageScreenshoterModule extends Module {
  constructor() {
    super();
    this.name = 'page-screenshoter';
    this.description = 'Web page screenshot capture tool';
    this.version = '1.0.0';
    this.metadataPath = './module.json';
  }

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  static async create(resourceManager) {
    const module = new PageScreenshoterModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create tools using metadata
    const screenshotTool = this.createToolFromMetadata('page_screenshot', PageScreenshotTool);
    this.registerTool(screenshotTool.name, screenshotTool);
  }
}