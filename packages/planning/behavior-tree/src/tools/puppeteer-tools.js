/**
 * Puppeteer Testing & Visual Capture Tools
 * Handles browser automation, screenshots, interactions, and performance testing
 */

import fs from 'fs/promises';
import path from 'path';

export class PuppeteerTools {
  constructor(workingDirectory = './generated-webapp') {
    this.workingDir = workingDirectory;
    this.browsers = new Map(); // Track browser instances
    this.screenshots = new Map(); // Track screenshot history
    this.testResults = [];
    this.performanceMetrics = new Map();
    
    // Create screenshots directory
    this.screenshotDir = path.join(this.workingDir, 'screenshots');
  }

  async ensureScreenshotDirectory() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await fs.mkdir(path.join(this.screenshotDir, 'full-page'), { recursive: true });
      await fs.mkdir(path.join(this.screenshotDir, 'elements'), { recursive: true });
      await fs.mkdir(path.join(this.screenshotDir, 'comparisons'), { recursive: true });
    } catch (error) {
      // Directories might already exist
    }
  }

  /**
   * Create browser manager tool
   */
  createBrowserManager() {
    const self = this;
    return {
      name: 'browserManager',
      async execute(params) {
        const {
          action, // launch, close, list
          browserName = 'default',
          headless = true,
          viewport = { width: 1280, height: 720 },
          devtools = false,
          slowMo = 0
        } = params;

        if (!action) {
          return {
            success: false,
            data: { error: 'action is required (launch, close, list)' }
          };
        }

        try {
          // Dynamic import of puppeteer
          const puppeteer = await import('puppeteer');

          const launchBrowser = async () => {
            if (self.browsers.has(browserName)) {
              return {
                success: false,
                data: { error: `Browser ${browserName} already running` }
              };
            }

            const browser = await puppeteer.launch({
              headless,
              devtools,
              slowMo,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
              ]
            });

            const page = await browser.newPage();
            await page.setViewport(viewport);

            self.browsers.set(browserName, {
              browser,
              page,
              viewport,
              launchedAt: Date.now(),
              screenshotCount: 0
            });

            return {
              success: true,
              data: {
                browserName,
                viewport,
                headless,
                pid: browser.process()?.pid,
                timestamp: Date.now()
              }
            };
          };

          const closeBrowser = async () => {
            const browserInstance = self.browsers.get(browserName);
            if (!browserInstance) {
              return {
                success: false,
                data: { error: `Browser ${browserName} not found` }
              };
            }

            try {
              await browserInstance.browser.close();
              self.browsers.delete(browserName);

              return {
                success: true,
                data: {
                  browserName,
                  message: 'Browser closed successfully',
                  timestamp: Date.now()
                }
              };
            } catch (error) {
              return {
                success: false,
                data: { error: `Failed to close browser: ${error.message}` }
              };
            }
          };

          const listBrowsers = () => {
            const browserList = [];
            for (const [name, instance] of self.browsers) {
              browserList.push({
                name,
                viewport: instance.viewport,
                launchedAt: instance.launchedAt,
                screenshotCount: instance.screenshotCount,
                isConnected: instance.browser.isConnected()
              });
            }

            return {
              success: true,
              data: {
                browsers: browserList,
                totalBrowsers: browserList.length,
                timestamp: Date.now()
              }
            };
          };

          switch (action) {
            case 'launch':
              return await launchBrowser();
            case 'close':
              return await closeBrowser();
            case 'list':
              return listBrowsers();
            default:
              return {
                success: false,
                data: { error: `Unknown action: ${action}` }
              };
          }

        } catch (error) {
          return {
            success: false,
            data: { error: `Browser manager error: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'browserManager',
          description: 'Manages Puppeteer browser instances',
          input: {
            action: { type: 'string', required: true },
            browserName: { type: 'string', required: false },
            headless: { type: 'boolean', required: false },
            viewport: { type: 'object', required: false },
            devtools: { type: 'boolean', required: false },
            slowMo: { type: 'number', required: false }
          },
          output: {
            browserName: { type: 'string' },
            viewport: { type: 'object' },
            pid: { type: 'number' }
          }
        };
      }
    };
  }

  /**
   * Create screenshot capture tool
   */
  createScreenshotCapture() {
    const self = this;
    return {
      name: 'screenshotCapture',
      async execute(params) {
        const {
          url,
          browserName = 'default',
          type = 'fullPage', // fullPage, viewport, element
          selector, // For element screenshots
          fileName,
          waitFor, // CSS selector or time to wait
          waitForTimeout = 5000,
          quality = 90,
          clip // Specific region to capture
        } = params;

        if (!url) {
          return {
            success: false,
            data: { error: 'url is required' }
          };
        }

        const browserInstance = self.browsers.get(browserName);
        if (!browserInstance) {
          return {
            success: false,
            data: { error: `Browser ${browserName} not found. Launch it first.` }
          };
        }

        try {
          await self.ensureScreenshotDirectory();
          const { page } = browserInstance;

          // Navigate to URL
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

          // Wait for specific condition if specified
          if (waitFor) {
            if (typeof waitFor === 'string' && waitFor.startsWith('#') || waitFor.startsWith('.')) {
              // CSS selector
              await page.waitForSelector(waitFor, { timeout: waitForTimeout });
            } else if (typeof waitFor === 'number') {
              // Wait for time
              await page.waitForTimeout(waitFor);
            }
          }

          // Generate filename if not provided
          const timestamp = Date.now();
          const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_');
          const defaultFileName = `${urlSafe}_${timestamp}.png`;
          const finalFileName = fileName || defaultFileName;

          let screenshotPath;
          let screenshotOptions = {};
          
          // Only add quality for JPEG files
          if (finalFileName.toLowerCase().endsWith('.jpg') || finalFileName.toLowerCase().endsWith('.jpeg')) {
            screenshotOptions.quality = quality;
          }

          if (type === 'fullPage') {
            screenshotPath = path.join(self.screenshotDir, 'full-page', finalFileName);
            screenshotOptions.fullPage = true;
          } else if (type === 'element' && selector) {
            screenshotPath = path.join(self.screenshotDir, 'elements', finalFileName);
            const element = await page.$(selector);
            if (!element) {
              return {
                success: false,
                data: { error: `Element not found: ${selector}` }
              };
            }
            screenshotOptions.fullPage = false;
            await element.screenshot({ ...screenshotOptions, path: screenshotPath });
          } else {
            screenshotPath = path.join(self.screenshotDir, finalFileName);
            if (clip) {
              screenshotOptions.clip = clip;
            }
          }

          // Take screenshot
          if (type !== 'element') {
            screenshotOptions.path = screenshotPath;
            await page.screenshot(screenshotOptions);
          }

          // Get page info
          const pageTitle = await page.title();
          const pageUrl = page.url();
          const viewport = page.viewport();

          // Update instance stats
          browserInstance.screenshotCount++;

          // Store screenshot metadata
          const screenshotData = {
            fileName: finalFileName,
            path: screenshotPath,
            url: pageUrl,
            title: pageTitle,
            type,
            selector,
            viewport,
            timestamp,
            size: 0 // Will be filled after file is written
          };

          try {
            const stats = await fs.stat(screenshotPath);
            screenshotData.size = stats.size;
          } catch {
            // Ignore size calculation error
          }

          // Store in history
          const urlHistory = self.screenshots.get(url) || [];
          urlHistory.push(screenshotData);
          self.screenshots.set(url, urlHistory);

          return {
            success: true,
            data: {
              ...screenshotData,
              browserName,
              totalScreenshots: browserInstance.screenshotCount
            }
          };

        } catch (error) {
          return {
            success: false,
            data: { error: `Screenshot capture failed: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'screenshotCapture',
          description: 'Captures screenshots of web pages and elements',
          input: {
            url: { type: 'string', required: true },
            browserName: { type: 'string', required: false },
            type: { type: 'string', required: false },
            selector: { type: 'string', required: false },
            fileName: { type: 'string', required: false },
            waitFor: { type: 'string|number', required: false },
            quality: { type: 'number', required: false }
          },
          output: {
            fileName: { type: 'string' },
            path: { type: 'string' },
            size: { type: 'number' },
            viewport: { type: 'object' }
          }
        };
      }
    };
  }

  /**
   * Create interaction tester tool
   */
  createInteractionTester() {
    const self = this;
    return {
      name: 'interactionTester',
      async execute(params) {
        const {
          url,
          browserName = 'default',
          interactions = [],
          recordSteps = true,
          screenshotAfterEach = false
        } = params;

        if (!url || interactions.length === 0) {
          return {
            success: false,
            data: { error: 'url and interactions array are required' }
          };
        }

        const browserInstance = self.browsers.get(browserName);
        if (!browserInstance) {
          return {
            success: false,
            data: { error: `Browser ${browserName} not found` }
          };
        }

        try {
          const { page } = browserInstance;
          const results = [];

          // Navigate to URL
          await page.goto(url, { waitUntil: 'networkidle2' });

          // Execute interactions
          for (let i = 0; i < interactions.length; i++) {
            const interaction = interactions[i];
            const stepResult = {
              step: i + 1,
              type: interaction.type,
              selector: interaction.selector,
              success: false,
              error: null,
              timing: 0,
              screenshot: null
            };

            const startTime = Date.now();

            try {
              switch (interaction.type) {
                case 'click':
                  await page.click(interaction.selector);
                  stepResult.success = true;
                  break;

                case 'type':
                  await page.type(interaction.selector, interaction.text);
                  stepResult.success = true;
                  stepResult.text = interaction.text;
                  break;

                case 'select':
                  await page.select(interaction.selector, interaction.value);
                  stepResult.success = true;
                  stepResult.value = interaction.value;
                  break;

                case 'wait':
                  if (interaction.selector) {
                    await page.waitForSelector(interaction.selector, { timeout: interaction.timeout || 5000 });
                  } else if (interaction.timeout) {
                    await new Promise(resolve => setTimeout(resolve, interaction.timeout));
                  }
                  stepResult.success = true;
                  break;

                case 'navigate':
                  await page.goto(interaction.url, { waitUntil: 'networkidle2' });
                  stepResult.success = true;
                  stepResult.url = interaction.url;
                  break;

                case 'scroll':
                  if (interaction.selector) {
                    await page.evaluate((sel) => {
                      document.querySelector(sel)?.scrollIntoView();
                    }, interaction.selector);
                  } else {
                    await page.evaluate((x, y) => window.scrollTo(x, y), 
                      interaction.x || 0, interaction.y || 0);
                  }
                  stepResult.success = true;
                  break;

                case 'evaluate':
                  // If code is a string, wrap it in a function
                  let evalCode = interaction.code;
                  if (typeof evalCode === 'string' && !evalCode.startsWith('(') && !evalCode.startsWith('function')) {
                    evalCode = `(() => { ${evalCode} })()`;
                  }
                  const result = await page.evaluate(evalCode);
                  stepResult.success = true;
                  stepResult.result = result;
                  break;

                default:
                  throw new Error(`Unknown interaction type: ${interaction.type}`);
              }

              stepResult.timing = Date.now() - startTime;

              // Take screenshot after step if requested
              if (screenshotAfterEach) {
                const screenshotName = `interaction_step_${i + 1}_${Date.now()}.png`;
                const screenshotPath = path.join(self.screenshotDir, screenshotName);
                await page.screenshot({ path: screenshotPath });
                stepResult.screenshot = screenshotPath;
              }

            } catch (error) {
              stepResult.error = error.message;
              stepResult.timing = Date.now() - startTime;
            }

            results.push(stepResult);

            // If step failed and not set to continue on error, stop
            if (!stepResult.success && !interaction.continueOnError) {
              break;
            }
          }

          const totalSteps = results.length;
          const successfulSteps = results.filter(r => r.success).length;
          const failedSteps = totalSteps - successfulSteps;

          return {
            success: failedSteps === 0,
            data: {
              url,
              totalSteps,
              successfulSteps,
              failedSteps,
              results,
              executionTime: results.reduce((sum, r) => sum + r.timing, 0),
              timestamp: Date.now()
            }
          };

        } catch (error) {
          return {
            success: false,
            data: { error: `Interaction testing failed: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'interactionTester',
          description: 'Performs automated interactions with web pages',
          input: {
            url: { type: 'string', required: true },
            browserName: { type: 'string', required: false },
            interactions: { type: 'array', required: true },
            recordSteps: { type: 'boolean', required: false },
            screenshotAfterEach: { type: 'boolean', required: false }
          },
          output: {
            totalSteps: { type: 'number' },
            successfulSteps: { type: 'number' },
            failedSteps: { type: 'number' },
            results: { type: 'array' }
          }
        };
      }
    };
  }

  /**
   * Create performance tester tool
   */
  createPerformanceTester() {
    const self = this;
    return {
      name: 'performanceTester',
      async execute(params) {
        const {
          url,
          browserName = 'default',
          metrics = ['FCP', 'LCP', 'CLS', 'FID'], // Core Web Vitals
          runs = 1,
          waitTime = 2000
        } = params;

        if (!url) {
          return {
            success: false,
            data: { error: 'url is required' }
          };
        }

        const browserInstance = self.browsers.get(browserName);
        if (!browserInstance) {
          return {
            success: false,
            data: { error: `Browser ${browserName} not found` }
          };
        }

        try {
          const { page } = browserInstance;
          const allResults = [];

          for (let run = 0; run < runs; run++) {
            // Clear cache and navigate
            await page.setCacheEnabled(false);
            await page.goto(url, { waitUntil: 'networkidle2' });
            
            // Wait for page to stabilize
            await new Promise(resolve => setTimeout(resolve, waitTime));

            const performanceMetrics = await page.evaluate(() => {
              return new Promise((resolve) => {
                const observer = new PerformanceObserver((list) => {
                  const entries = list.getEntries();
                  const results = {};

                  entries.forEach((entry) => {
                    if (entry.entryType === 'paint') {
                      if (entry.name === 'first-contentful-paint') {
                        results.FCP = entry.startTime;
                      }
                    } else if (entry.entryType === 'largest-contentful-paint') {
                      results.LCP = entry.startTime;
                    } else if (entry.entryType === 'layout-shift') {
                      results.CLS = (results.CLS || 0) + entry.value;
                    } else if (entry.entryType === 'first-input') {
                      results.FID = entry.processingStart - entry.startTime;
                    }
                  });

                  // Also get navigation timing
                  const navigation = performance.getEntriesByType('navigation')[0];
                  if (navigation) {
                    results.TTFB = navigation.responseStart - navigation.requestStart;
                    results.DOMLoad = navigation.domContentLoadedEventEnd - navigation.navigationStart;
                    results.WindowLoad = navigation.loadEventEnd - navigation.navigationStart;
                  }

                  resolve(results);
                });

                observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input'] });

                // Fallback timeout
                setTimeout(() => {
                  const navigation = performance.getEntriesByType('navigation')[0];
                  const fallbackResults = {};
                  
                  if (navigation) {
                    fallbackResults.TTFB = navigation.responseStart - navigation.requestStart;
                    fallbackResults.DOMLoad = navigation.domContentLoadedEventEnd - navigation.navigationStart;
                    fallbackResults.WindowLoad = navigation.loadEventEnd - navigation.navigationStart;
                  }
                  
                  resolve(fallbackResults);
                }, 10000);
              });
            });

            // Get additional metrics
            const memoryUsage = await page.evaluate(() => {
              if (performance.memory) {
                return {
                  usedJSHeapSize: performance.memory.usedJSHeapSize,
                  totalJSHeapSize: performance.memory.totalJSHeapSize,
                  jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
              }
              return null;
            });

            const runResult = {
              run: run + 1,
              url,
              metrics: performanceMetrics,
              memory: memoryUsage,
              timestamp: Date.now()
            };

            allResults.push(runResult);
          }

          // Calculate averages if multiple runs
          const averages = {};
          if (runs > 1) {
            const allMetrics = allResults.map(r => r.metrics);
            const metricKeys = new Set();
            allMetrics.forEach(m => Object.keys(m).forEach(k => metricKeys.add(k)));

            for (const key of metricKeys) {
              const values = allMetrics.map(m => m[key]).filter(v => v !== undefined);
              if (values.length > 0) {
                averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
              }
            }
          }

          // Store performance data
          const performanceData = {
            url,
            runs: allResults,
            averages: runs > 1 ? averages : null,
            summary: {
              totalRuns: runs,
              timestamp: Date.now()
            }
          };

          const urlMetrics = self.performanceMetrics.get(url) || [];
          urlMetrics.push(performanceData);
          self.performanceMetrics.set(url, urlMetrics);

          return {
            success: true,
            data: performanceData
          };

        } catch (error) {
          return {
            success: false,
            data: { error: `Performance testing failed: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'performanceTester',
          description: 'Measures web page performance metrics including Core Web Vitals',
          input: {
            url: { type: 'string', required: true },
            browserName: { type: 'string', required: false },
            metrics: { type: 'array', required: false },
            runs: { type: 'number', required: false },
            waitTime: { type: 'number', required: false }
          },
          output: {
            runs: { type: 'array' },
            averages: { type: 'object' },
            summary: { type: 'object' }
          }
        };
      }
    };
  }

  /**
   * Create visual regression tester tool
   */
  createVisualRegressionTester() {
    const self = this;
    return {
      name: 'visualRegressionTester',
      async execute(params) {
        const {
          url,
          browserName = 'default',
          baselineImage,
          threshold = 0.1, // Difference threshold (0-1)
          generateBaseline = false
        } = params;

        if (!url) {
          return {
            success: false,
            data: { error: 'url is required' }
          };
        }

        try {
          await self.ensureScreenshotDirectory();

          // Generate baseline if requested
          if (generateBaseline) {
            const timestamp = Date.now();
            const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_');
            const baselineName = `baseline_${urlSafe}_${timestamp}.png`;
            
            // Take screenshot using existing tool
            const screenshotTool = self.createScreenshotCapture();
            const screenshotResult = await screenshotTool.execute({
              url,
              browserName,
              fileName: baselineName,
              type: 'fullPage'
            });

            if (!screenshotResult.success) {
              return screenshotResult;
            }

            return {
              success: true,
              data: {
                action: 'baseline_created',
                baselineImage: baselineName,
                path: screenshotResult.data.path,
                url,
                timestamp: Date.now()
              }
            };
          }

          // Compare with existing baseline
          if (!baselineImage) {
            return {
              success: false,
              data: { error: 'baselineImage is required for comparison, or set generateBaseline=true' }
            };
          }

          // Take current screenshot
          const timestamp = Date.now();
          const currentImageName = `current_${timestamp}.png`;
          
          const screenshotTool = self.createScreenshotCapture();
          const currentResult = await screenshotTool.execute({
            url,
            browserName,
            fileName: currentImageName,
            type: 'fullPage'
          });

          if (!currentResult.success) {
            return currentResult;
          }

          // For now, return basic comparison data
          // In a real implementation, you'd use image comparison libraries like pixelmatch
          const comparisonResult = {
            url,
            baselineImage,
            currentImage: currentImageName,
            baselinePath: path.join(self.screenshotDir, 'full-page', baselineImage),
            currentPath: currentResult.data.path,
            threshold,
            // Placeholder for actual comparison results
            differences: {
              pixelDifference: 0, // Would be calculated by image comparison
              percentageDifference: 0,
              hasDifferences: false
            },
            status: 'comparison_completed', // 'passed', 'failed', 'comparison_completed'
            timestamp
          };

          // Store comparison result
          const comparisonPath = path.join(self.screenshotDir, 'comparisons', `comparison_${timestamp}.json`);
          await fs.writeFile(comparisonPath, JSON.stringify(comparisonResult, null, 2));

          return {
            success: true,
            data: {
              ...comparisonResult,
              comparisonFile: comparisonPath,
              note: 'Visual comparison completed. Implement pixelmatch or similar library for actual pixel comparison.'
            }
          };

        } catch (error) {
          return {
            success: false,
            data: { error: `Visual regression testing failed: ${error.message}` }
          };
        }
      },
      getMetadata() {
        return {
          name: 'visualRegressionTester',
          description: 'Compares screenshots for visual regression testing',
          input: {
            url: { type: 'string', required: true },
            browserName: { type: 'string', required: false },
            baselineImage: { type: 'string', required: false },
            threshold: { type: 'number', required: false },
            generateBaseline: { type: 'boolean', required: false }
          },
          output: {
            baselineImage: { type: 'string' },
            currentImage: { type: 'string' },
            differences: { type: 'object' },
            status: { type: 'string' }
          }
        };
      }
    };
  }

  /**
   * Get all screenshot history
   */
  getAllScreenshots() {
    return Object.fromEntries(this.screenshots);
  }

  /**
   * Get performance metrics history
   */
  getAllPerformanceMetrics() {
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Get all running browsers
   */
  getRunningBrowsers() {
    const browsers = {};
    for (const [name, instance] of this.browsers) {
      browsers[name] = {
        viewport: instance.viewport,
        launchedAt: instance.launchedAt,
        screenshotCount: instance.screenshotCount,
        isConnected: instance.browser.isConnected()
      };
    }
    return browsers;
  }

  /**
   * Close all browsers and clean up
   */
  async closeAllBrowsers() {
    let closed = 0;
    for (const [name, instance] of this.browsers) {
      try {
        if (instance.browser.isConnected()) {
          await instance.browser.close();
          closed++;
        }
      } catch (error) {
        console.warn(`Failed to close browser ${name}:`, error.message);
      }
    }
    
    this.browsers.clear();
    return closed;
  }

  /**
   * Clear all stored data
   */
  clearAllData() {
    this.screenshots.clear();
    this.performanceMetrics.clear();
    this.testResults = [];
  }
}