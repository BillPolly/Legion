const { Tool } = require('@jsenvoy/modules');
const puppeteer = require('puppeteer');

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
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['url']);
      
      // Take the screenshot
      const result = await this.screenshot(
        args.url,
        args.fullPage,
        args.width,
        args.height,
        args.waitForSelector
      );
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        result
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Takes a screenshot of a webpage
   */
  async screenshot(url, fullPage = false, width = 1280, height = 720, waitForSelector = null) {
    let browser = null;
    
    try {
      console.log(`Taking screenshot of: ${url}`);
      
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
      
      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (!response.ok()) {
        throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
      }
      
      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Wait a bit for any animations to complete
      await page.waitForTimeout(1000);
      
      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: fullPage,
        type: 'png',
        encoding: 'base64'
      });
      
      console.log(`Successfully captured screenshot of ${url}`);
      
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

module.exports = PageScreenshot;