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
   * Record a video of the browser session
   */
  async recordVideo(options = {}) {
    const {
      path: outputPath,
      duration = 10, // Default 10 seconds
      url = null,
      actions = null,
      format = null // Optional format override
    } = options;
    
    return safeOperation(async () => {
      // Determine format from path extension or use format parameter
      let videoFormat = 'webm'; // Default format
      let videoPath = outputPath;
      
      if (!videoPath) {
        // No path provided, use default with format
        videoFormat = format || 'webm';
        videoPath = path.join(process.cwd(), 'videos', `recording-${Date.now()}.${videoFormat}`);
      } else {
        // Path provided, extract format from extension
        const ext = path.extname(videoPath).toLowerCase().slice(1);
        if (ext && ['webm', 'mp4', 'mov', 'avi', 'gif'].includes(ext)) {
          videoFormat = ext;
        } else if (format) {
          // Use format parameter if provided
          videoFormat = format;
          // Add extension if not present
          if (!path.extname(videoPath)) {
            videoPath = `${videoPath}.${videoFormat}`;
          }
        } else {
          // No extension and no format, add default
          if (!path.extname(videoPath)) {
            videoPath = `${videoPath}.webm`;
          }
        }
      }
      
      const videoDir = path.dirname(videoPath);
      await fs.mkdir(videoDir, { recursive: true });
      
      // Special handling for GIF format
      if (videoFormat === 'gif') {
        return await this._recordAnimatedGif(videoPath, duration, url, actions);
      }
      
      // For video formats, use Playwright's video recording
      // Close current context if exists
      if (this.browserManager.context) {
        await this.browserManager.closeContext();
      }
      
      // Create new context with video recording
      await this.browserManager.createContext({
        recordVideo: {
          dir: videoDir,
          size: { width: 1280, height: 720 }
        }
      });
      
      // Create new page
      await this.browserManager.createPage();
      const page = await this.browserManager.getPage();
      
      // Navigate if URL provided
      if (url) {
        await page.goto(url, { waitUntil: 'networkidle' });
      }
      
      // Execute custom actions if provided
      if (actions && typeof actions === 'function') {
        await actions(page);
      }
      
      // Wait for the specified duration
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      
      // Get video object from page
      const video = await page.video();
      
      // Close context to save video
      await this.browserManager.closeContext();
      
      // Wait a bit for video to be written
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the video path
      const actualVideoPath = await video.path();
      
      if (actualVideoPath) {
        let finalVideoPath = videoPath;
        
        // Playwright always records in WebM format
        // If user requested a different format, we need to handle it
        if (videoFormat !== 'webm') {
          // Check if ffmpeg is available for conversion
          const ffmpegAvailable = await this._checkFfmpeg();
          
          if (ffmpegAvailable && ['mp4', 'mov', 'avi'].includes(videoFormat)) {
            // Convert using ffmpeg
            console.log(`Converting WebM to ${videoFormat.toUpperCase()}...`);
            const convertedPath = await this._convertVideo(actualVideoPath, videoPath, videoFormat);
            finalVideoPath = convertedPath;
            
            // Clean up original WebM file
            await fs.unlink(actualVideoPath);
          } else {
            // Can't convert, save as WebM with warning
            console.warn(`Cannot convert to ${videoFormat} format. Saving as WebM instead.`);
            finalVideoPath = videoPath.replace(/\.[^.]+$/, '.webm');
            await fs.rename(actualVideoPath, finalVideoPath);
          }
        } else {
          // Requested format is WebM, just move the file
          if (actualVideoPath !== videoPath) {
            await fs.rename(actualVideoPath, videoPath);
          }
        }
        
        const stats = await fs.stat(finalVideoPath);
        
        return {
          success: true,
          path: finalVideoPath,
          size: stats.size,
          duration: duration,
          format: finalVideoPath.endsWith('.webm') ? 'webm' : videoFormat,
          timestamp: new Date().toISOString(),
          warning: finalVideoPath !== videoPath ? `Saved as ${path.extname(finalVideoPath).slice(1).toUpperCase()} format` : null
        };
      } else {
        throw new Error('Video file not found after recording');
      }
    }, { action: 'recordVideo' });
  }

  /**
   * Record animated GIF by taking screenshots
   */
  async _recordAnimatedGif(gifPath, duration, url, actions) {
    console.log('Creating animated GIF from screenshots...');
    
    await this.initialize();
    const page = await this.browserManager.getPage();
    
    // Navigate if URL provided
    if (url) {
      await page.goto(url, { waitUntil: 'networkidle' });
    }
    
    // Execute custom actions if provided
    if (actions && typeof actions === 'function') {
      await actions(page);
    }
    
    // Calculate frame settings
    const fps = 10; // 10 frames per second for smooth animation
    const frameCount = duration * fps;
    const frameDelay = 1000 / fps; // milliseconds between frames
    
    const tempDir = path.join(path.dirname(gifPath), `temp-gif-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const screenshots = [];
    
    // Capture screenshots
    console.log(`Capturing ${frameCount} frames...`);
    for (let i = 0; i < frameCount; i++) {
      const framePath = path.join(tempDir, `frame-${String(i).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath, fullPage: false });
      screenshots.push(framePath);
      
      // Show progress
      if (i % 10 === 0) {
        console.log(`  Progress: ${Math.round((i / frameCount) * 100)}%`);
      }
      
      // Wait for next frame
      await new Promise(resolve => setTimeout(resolve, frameDelay));
    }
    console.log('  Progress: 100%');
    
    // Check if we can create GIF
    const gifskiAvailable = await this._checkGifski();
    const imagemagickAvailable = await this._checkImageMagick();
    
    let gifCreated = false;
    
    if (gifskiAvailable) {
      // Use gifski for high-quality GIF
      console.log('Creating GIF with gifski...');
      try {
        await this._createGifWithGifski(screenshots, gifPath, fps);
        gifCreated = true;
      } catch (error) {
        console.error('Gifski failed:', error.message);
      }
    } else if (imagemagickAvailable) {
      // Use ImageMagick as fallback
      console.log('Creating GIF with ImageMagick...');
      try {
        await this._createGifWithImageMagick(screenshots, gifPath, frameDelay);
        gifCreated = true;
      } catch (error) {
        console.error('ImageMagick failed:', error.message);
      }
    }
    
    // Clean up temp files
    for (const screenshot of screenshots) {
      await fs.unlink(screenshot);
    }
    await fs.rmdir(tempDir);
    
    if (gifCreated) {
      const stats = await fs.stat(gifPath);
      return {
        success: true,
        path: gifPath,
        size: stats.size,
        duration: duration,
        format: 'gif',
        frameCount: frameCount,
        fps: fps,
        timestamp: new Date().toISOString()
      };
    } else {
      // No GIF tools available, save first screenshot as static image
      console.warn('No GIF creation tools available. Install gifski or ImageMagick for animated GIFs.');
      console.warn('Saving first frame as static PNG instead.');
      
      const staticPath = gifPath.replace(/\.gif$/, '.png');
      await page.screenshot({ path: staticPath, fullPage: false });
      
      return {
        success: true,
        path: staticPath,
        size: (await fs.stat(staticPath)).size,
        duration: 0,
        format: 'png',
        timestamp: new Date().toISOString(),
        warning: 'Saved as static PNG. Install gifski or ImageMagick for animated GIFs.'
      };
    }
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

  /**
   * Check if ffmpeg is available
   */
  async _checkFfmpeg() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('ffmpeg -version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if gifski is available
   */
  async _checkGifski() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('gifski --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if ImageMagick is available
   */
  async _checkImageMagick() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('convert -version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert video using ffmpeg
   */
  async _convertVideo(inputPath, outputPath, format) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      // Basic conversion command - can be enhanced with quality settings
      const command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 22 "${outputPath}" -y`;
      await execAsync(command);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to convert video: ${error.message}`);
    }
  }

  /**
   * Create GIF using gifski
   */
  async _createGifWithGifski(screenshots, outputPath, fps) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const pattern = path.join(path.dirname(screenshots[0]), 'frame-*.png');
    const command = `gifski -o "${outputPath}" --fps ${fps} --quality 80 "${pattern}"`;
    
    await execAsync(command);
  }

  /**
   * Create GIF using ImageMagick
   */
  async _createGifWithImageMagick(screenshots, outputPath, frameDelay) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const delay = Math.round(frameDelay / 10); // ImageMagick uses centiseconds
    const pattern = path.join(path.dirname(screenshots[0]), 'frame-*.png');
    const command = `convert -delay ${delay} -loop 0 "${pattern}" "${outputPath}"`;
    
    await execAsync(command);
  }
}