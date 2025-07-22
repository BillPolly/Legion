import { Tool, ToolResult } from '@legion/module-loader';
import puppeteer from 'puppeteer';

class PageScreenshot extends Tool {
  constructor() {
    super();
    this.name = 'page_screenshot';
    this.description = 'Takes screenshots of web pages';
  }

  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'page_screenshot_capture',
        description: 'Take a screenshot of a webpage and return it as a base64-encoded image',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the webpage to screenshot'
            },
            fullPage: {
              type: 'boolean',
              description: 'Whether to capture the full page or just the viewport (default: false)'
            },
            width: {
              type: 'number',
              description: 'Viewport width in pixels (default: 1280)'
            },
            height: {
              type: 'number',
              description: 'Viewport height in pixels (default: 720)'
            },
            waitForSelector: {
              type: 'string',
              description: 'Optional CSS selector to wait for before taking screenshot'
            }
          },
          required: ['url']
        }
      }
    };
  }

  /**
   * Invokes the screenshot tool with the given tool call
   */
  async invoke(toolCall) {
    let args;
    try {
      // Parse the arguments
      args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['url']);
      
      // Emit progress event
      this.emitProgress(`Starting screenshot capture: ${args.url}`, {
        url: args.url,
        fullPage: args.fullPage || false,
        viewport: { width: args.width || 1280, height: args.height || 720 }
      });
      
      // Take the screenshot
      const result = await this.screenshot(
        args.url,
        args.fullPage,
        args.width,
        args.height,
        args.waitForSelector
      );
      
      // Emit success event
      this.emitInfo(`Screenshot captured successfully`, {
        url: args.url,
        fullPage: result.fullPage,
        dimensions: result.dimensions
      });
      
      // Return success response
      return ToolResult.success(result);
    } catch (error) {
      // Emit error event
      this.emitError(`Failed to capture screenshot: ${error.message}`, {
        url: args?.url || 'unknown',
        error: error.message
      });
      
      // Return error response
      return ToolResult.failure(
        error.message || 'Failed to capture screenshot',
        {
          url: args?.url || 'unknown',
          errorType: 'screenshot_error'
        }
      );
    }
  }

  /**
   * Takes a screenshot of a webpage
   */
  async screenshot(url, fullPage = false, width = 1280, height = 720, waitForSelector = null) {
    let browser = null;
    
    try {
      // Emit progress for browser launch
      this.emitProgress('Launching browser for screenshot', {
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
      this.emitProgress(`Navigating to ${url}`, {
        stage: 'navigation',
        url: url
      });
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (!response.ok()) {
        this.emitWarning(`Page returned status ${response.status()}`, {
          status: response.status(),
          statusText: response.statusText()
        });
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        this.emitProgress(`Waiting for selector: ${waitForSelector}`, {
          stage: 'wait_selector',
          selector: waitForSelector
        });
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Wait a bit for any animations to complete
      this.emitProgress('Waiting for animations to complete', {
        stage: 'wait_animations'
      });
      await page.waitForTimeout(1000);
      
      // Emit progress for screenshot capture
      this.emitProgress('Capturing screenshot', {
        stage: 'screenshot_capture',
        fullPage: fullPage
      });
      
      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: fullPage,
        type: 'png',
        encoding: 'base64'
      });
      
      this.emitInfo('Screenshot captured', {
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