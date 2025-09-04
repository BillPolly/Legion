/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';
import puppeteer from 'puppeteer';

// Input schema for PageScreenshot
const pageScreenshotInputSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'The URL of the webpage to screenshot'
    },
    fullPage: {
      type: 'boolean',
      default: false,
      description: 'Whether to capture the full page or just the viewport'
    },
    width: {
      type: 'number',
      default: 1280,
      description: 'Viewport width in pixels'
    },
    height: {
      type: 'number',
      default: 720,
      description: 'Viewport height in pixels'
    },
    waitForSelector: {
      type: 'string',
      description: 'Optional CSS selector to wait for before taking screenshot'
    }
  },
  required: ['url']
};

// Output schema for PageScreenshot
const pageScreenshotOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the screenshot was successful'
    },
    url: {
      type: 'string',
      description: 'The URL that was screenshotted'
    },
    image: {
      type: 'string',
      description: 'Base64 encoded screenshot image'
    },
    isImage: {
      type: 'boolean',
      description: 'Indicates this is an image result'
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the image'
    },
    fullPage: {
      type: 'boolean',
      description: 'Whether full page was captured'
    },
    dimensions: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: ['number', 'string'] }
      },
      description: 'Screenshot dimensions'
    }
  },
  required: ['success', 'url', 'image']
};

class PageScreenshot extends Tool {
  constructor() {
    super({
      name: 'page_screenshot',
      description: 'Takes screenshots of web pages',
      inputSchema: pageScreenshotInputSchema,
      outputSchema: pageScreenshotOutputSchema
    });
  }

  /**
   * Execute the screenshot tool with validated parameters
   */
  async _execute(params) {
    const { url, fullPage, width, height, waitForSelector } = params;
    
    // Emit progress event
    this.progress(`Starting screenshot capture: ${url}`, 0, {
      url,
      fullPage,
      viewport: { width, height }
    });
    
    // Take the screenshot
    const result = await this.screenshot(
      url,
      fullPage,
      width,
      height,
      waitForSelector
    );
    
    // Emit success event
    this.info(`Screenshot captured successfully`, {
        url: url,
        fullPage: result.fullPage,
        dimensions: result.dimensions
      });
      
      // Emit completion
      this.progress('Screenshot capture complete', 100);
      
      return result;
  }

  /**
   * Takes a screenshot of a webpage
   */
  async screenshot(url, fullPage = false, width = 1280, height = 720, waitForSelector = null) {
    let browser = null;
    
    try {
      // Emit progress for browser launch
      this.progress('Launching browser for screenshot', 25, {
        stage: 'browser_launch'
      });
      
      // Launch browser
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set viewport size
      await page.setViewport({ width, height });
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Emit progress for navigation
      this.progress(`Navigating to ${url}`, 50, {
        stage: 'navigation',
        url: url
      });
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (!response.ok()) {
        this.warning(`Page returned status ${response.status()}`, {
          status: response.status(),
          statusText: response.statusText()
        });
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        this.progress(`Waiting for selector: ${waitForSelector}`, 60, {
          stage: 'wait_selector',
          selector: waitForSelector
        });
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Wait a bit for any animations to complete
      this.progress('Waiting for animations to complete', 75, {
        stage: 'wait_animations'
      });
      await page.waitForTimeout(1000);
      
      // Emit progress for screenshot capture
      this.progress('Capturing screenshot', 90, {
        stage: 'screenshot_capture',
        fullPage: fullPage
      });
      
      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: fullPage,
        type: 'png',
        encoding: 'base64'
      });
      
      this.info('Screenshot captured', {
        url: url,
        fullPage: fullPage,
        encoding: 'base64'
      });
      
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

export default PageScreenshot;