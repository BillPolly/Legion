/**
 * FrontendDebuggingWorkflow - Complete frontend debugging workflow
 * 
 * Orchestrates browser automation with Playwright and real-time debugging
 * with Cerebrate Chrome DevTools extension for comprehensive frontend testing.
 */

import { EventEmitter } from 'events';

class FrontendDebuggingWorkflow extends EventEmitter {
  constructor(codeAgent) {
    super();
    
    this.codeAgent = codeAgent;
    this.browserPhase = codeAgent.browserTestingPhase;
    this.cerebrateIntegration = null; // Will be initialized when available
    
    // Workflow state
    this.currentWorkflow = null;
    this.results = [];
    this.debuggingSessions = new Map();
  }

  /**
   * Initialize workflow with Cerebrate integration
   * @param {Object} cerebrateConfig - Cerebrate configuration
   * @returns {Promise<void>}
   */
  async initialize(cerebrateConfig = {}) {
    // Import CerebrateIntegration dynamically to avoid dependency issues if not available
    try {
      const { CerebrateIntegration } = await import('../integration/CerebrateIntegration.js');
      this.cerebrateIntegration = new CerebrateIntegration(this.codeAgent, cerebrateConfig);
      await this.cerebrateIntegration.initialize();
      
      this.codeAgent.emit('info', {
        message: 'Frontend debugging workflow initialized with Cerebrate integration'
      });
      
    } catch (error) {
      this.codeAgent.emit('warning', {
        message: `Cerebrate integration not available, using Playwright only: ${error.message}`
      });
    }
  }

  /**
   * Run comprehensive frontend debugging workflow
   * @param {string} url - URL to debug
   * @param {Object} workflowConfig - Workflow configuration
   * @returns {Promise<Object>} - Workflow results
   */
  async runDebuggingWorkflow(url, workflowConfig = {}) {
    const {
      useCerebrate = true,
      takeScreenshots = true,
      analyzePerformance = true,
      checkAccessibility = true,
      captureErrors = true,
      extractContent = true,
      customTests = []
    } = workflowConfig;

    this.currentWorkflow = {
      url,
      config: workflowConfig,
      startTime: new Date(),
      steps: []
    };

    this.codeAgent.emit('phase-start', {
      phase: 'frontend-debugging',
      message: `Starting comprehensive frontend debugging for: ${url}`,
      emoji: '🔍'
    });

    const workflowResult = {
      url,
      success: true,
      steps: {},
      errors: [],
      startTime: this.currentWorkflow.startTime,
      endTime: null
    };

    try {
      // Step 1: Start browser session with Playwright
      await this._executeStep('browser_init', async () => {
        await this.browserPhase.startSession();
        return { success: true, message: 'Browser session started' };
      }, workflowResult);

      // Step 2: Navigate to URL with browser automation
      await this._executeStep('browser_navigation', async () => {
        const result = await this.browserPhase.navigateAndValidate(url);
        if (!result.success) {
          throw new Error(`Navigation failed: ${result.error}`);
        }
        return result;
      }, workflowResult);

      // Step 3: Start Cerebrate debugging session (if available)
      let cerebrateSessionId = null;
      if (useCerebrate && this.cerebrateIntegration) {
        await this._executeStep('cerebrate_debug_start', async () => {
          // Wait for Chrome extension to be ready
          const extensionReady = await this.cerebrateIntegration.waitForExtension(10000);
          if (!extensionReady) {
            throw new Error('Cerebrate Chrome extension not ready');
          }

          const result = await this.cerebrateIntegration.startDebuggingSession(url, {
            enableDOMInspection: true,
            enablePerformanceMonitoring: analyzePerformance,
            enableErrorCapture: captureErrors
          });

          if (result.success) {
            cerebrateSessionId = result.sessionId;
            this.debuggingSessions.set(cerebrateSessionId, {
              url,
              type: 'cerebrate',
              startTime: new Date()
            });
          }

          return result;
        }, workflowResult);
      }

      // Step 4: Take initial screenshots
      if (takeScreenshots) {
        await this._executeStep('screenshot_capture', async () => {
          const result = await this.browserPhase.captureScreenshot({
            fullPage: true,
            format: 'png'
          });
          return result;
        }, workflowResult);
      }

      // Step 5: Extract page content with browser automation
      if (extractContent) {
        await this._executeStep('content_extraction', async () => {
          const selectors = {
            title: 'title',
            headings: 'h1, h2, h3, h4, h5, h6',
            links: 'a[href]',
            images: 'img[src]',
            forms: 'form',
            scripts: 'script[src]',
            stylesheets: 'link[rel="stylesheet"]'
          };
          
          const result = await this.browserPhase.extractPageData(selectors, {
            multiple: true
          });
          return result;
        }, workflowResult);
      }

      // Step 6: Performance analysis (dual approach)
      if (analyzePerformance) {
        await this._executeStep('performance_analysis', async () => {
          const results = {};

          // Browser-based performance analysis
          const browserPerf = await this.browserPhase.executeJavaScript(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            const resources = performance.getEntriesByType('resource');
            
            return {
              navigation: nav ? {
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                loadComplete: nav.loadEventEnd - nav.loadEventStart,
                totalTime: nav.loadEventEnd - nav.fetchStart
              } : null,
              paint: {
                firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || null,
                firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null
              },
              resources: {
                totalResources: resources.length,
                totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                slowestResource: resources.reduce((slowest, r) => 
                  r.duration > (slowest?.duration || 0) ? r : slowest, null)
              }
            };
          });

          results.browser = browserPerf;

          // Cerebrate-based performance analysis (if available)
          if (cerebrateSessionId) {
            try {
              const cerebratePerf = await this.cerebrateIntegration.analyzePerformance(cerebrateSessionId);
              results.cerebrate = cerebratePerf;
            } catch (error) {
              results.cerebrateError = error.message;
            }
          }

          return {
            success: true,
            results
          };
        }, workflowResult);
      }

      // Step 7: Accessibility analysis (dual approach)
      if (checkAccessibility) {
        await this._executeStep('accessibility_analysis', async () => {
          const results = {};

          // Browser-based accessibility check
          const browserA11y = await this.browserPhase.executeJavaScript(() => {
            const issues = [];
            
            // Check images without alt text
            const images = document.querySelectorAll('img:not([alt])');
            if (images.length > 0) {
              issues.push(`${images.length} images missing alt text`);
            }
            
            // Check for proper heading structure
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const hasH1 = document.querySelector('h1') !== null;
            if (headings.length > 0 && !hasH1) {
              issues.push('No H1 heading found');
            }
            
            // Check form inputs for labels
            const unlabeledInputs = document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])');
            const unlabeledCount = Array.from(unlabeledInputs).filter(input => {
              const label = document.querySelector(`label[for="${input.id}"]`) || input.closest('label');
              return !label;
            }).length;
            
            if (unlabeledCount > 0) {
              issues.push(`${unlabeledCount} form inputs without labels`);
            }
            
            return {
              issues,
              score: Math.max(0, 100 - (issues.length * 25))
            };
          });

          results.browser = browserA11y;

          // Cerebrate-based accessibility analysis (if available)
          if (cerebrateSessionId) {
            try {
              const cerebrateA11y = await this.cerebrateIntegration.executeDebugCommand(
                cerebrateSessionId, 
                'analyze_accessibility'
              );
              results.cerebrate = cerebrateA11y;
            } catch (error) {
              results.cerebrateError = error.message;
            }
          }

          return {
            success: true,
            results
          };
        }, workflowResult);
      }

      // Step 8: Error capture (dual approach)
      if (captureErrors) {
        await this._executeStep('error_capture', async () => {
          const results = {};

          // Browser logs from Playwright
          const browserLogs = this.browserPhase.getBrowserLogs();
          const errorLogs = browserLogs.filter(log => 
            log.type === 'javascript' && !log.success
          );

          results.browser = {
            totalLogs: browserLogs.length,
            errorLogs: errorLogs.length,
            errors: errorLogs.map(log => ({
              message: log.error || log.result,
              timestamp: log.timestamp
            }))
          };

          // Cerebrate error capture (if available)
          if (cerebrateSessionId) {
            try {
              const cerebrateErrors = await this.cerebrateIntegration.captureErrors(cerebrateSessionId);
              results.cerebrate = cerebrateErrors;
            } catch (error) {
              results.cerebrateError = error.message;
            }
          }

          return {
            success: true,
            results
          };
        }, workflowResult);
      }

      // Step 9: Custom tests
      for (const customTest of customTests) {
        await this._executeStep(`custom_test_${customTest.name}`, async () => {
          if (customTest.type === 'browser') {
            return await this.browserPhase.executeJavaScript(customTest.script);
          } else if (customTest.type === 'cerebrate' && cerebrateSessionId) {
            return await this.cerebrateIntegration.executeDebugCommand(
              cerebrateSessionId,
              customTest.command,
              customTest.params
            );
          } else {
            throw new Error(`Unsupported test type: ${customTest.type}`);
          }
        }, workflowResult);
      }

      // Step 10: Cleanup
      await this._executeStep('cleanup', async () => {
        const results = {};

        // End Cerebrate session if active
        if (cerebrateSessionId) {
          try {
            await this.cerebrateIntegration.endDebuggingSession(cerebrateSessionId);
            results.cerebrateCleanup = 'success';
          } catch (error) {
            results.cerebrateCleanupError = error.message;
          }
        }

        // Browser cleanup handled by afterEach in tests
        results.browserCleanup = 'deferred';

        return {
          success: true,
          results
        };
      }, workflowResult);

    } catch (error) {
      workflowResult.success = false;
      workflowResult.errors.push(`Workflow error: ${error.message}`);
      
      this.codeAgent.emit('error', {
        message: `Frontend debugging workflow failed: ${error.message}`,
        url,
        error
      });
    }

    workflowResult.endTime = new Date();
    workflowResult.duration = workflowResult.endTime - workflowResult.startTime;
    
    this.results.push(workflowResult);
    this.currentWorkflow = null;

    this.codeAgent.emit('phase-complete', {
      phase: 'frontend-debugging',
      message: `Frontend debugging workflow completed - ${workflowResult.success ? 'SUCCESS' : 'FAILED'}`
    });

    return workflowResult;
  }

  /**
   * Execute a workflow step with error handling
   * @param {string} stepName - Name of the step
   * @param {Function} stepFunction - Function to execute
   * @param {Object} workflowResult - Workflow result object to update
   * @private
   */
  async _executeStep(stepName, stepFunction, workflowResult) {
    this.codeAgent.emit('info', {
      message: `Executing step: ${stepName}`
    });

    const stepStart = new Date();
    
    try {
      const result = await stepFunction();
      
      workflowResult.steps[stepName] = {
        success: true,
        result,
        duration: new Date() - stepStart,
        timestamp: stepStart.toISOString()
      };
      
      this.currentWorkflow.steps.push({
        name: stepName,
        success: true,
        duration: new Date() - stepStart
      });

    } catch (error) {
      workflowResult.steps[stepName] = {
        success: false,
        error: error.message,
        duration: new Date() - stepStart,
        timestamp: stepStart.toISOString()
      };
      
      workflowResult.errors.push(`Step ${stepName} failed: ${error.message}`);
      
      this.currentWorkflow.steps.push({
        name: stepName,
        success: false,
        error: error.message,
        duration: new Date() - stepStart
      });

      throw error; // Re-throw to stop workflow
    }
  }

  /**
   * Compare browser automation vs Cerebrate results
   * @param {string} url - URL that was tested
   * @returns {Object} - Comparison report
   */
  generateComparisonReport(url) {
    const urlResults = this.results.filter(r => r.url === url);
    if (urlResults.length === 0) {
      return { error: 'No results found for URL' };
    }

    const latestResult = urlResults[urlResults.length - 1];
    const report = {
      url,
      timestamp: new Date().toISOString(),
      workflow: {
        success: latestResult.success,
        duration: latestResult.duration,
        stepsCompleted: Object.keys(latestResult.steps).length,
        errors: latestResult.errors
      },
      capabilities: {
        browserAutomation: {
          available: true,
          features: ['navigation', 'screenshots', 'content_extraction', 'javascript_execution']
        },
        cerebrateIntegration: {
          available: !!this.cerebrateIntegration?.isConnected(),
          extensionConnected: this.cerebrateIntegration?.isExtensionConnected() || false,
          features: ['dom_inspection', 'performance_monitoring', 'error_capture', 'real_time_debugging']
        }
      },
      dataComparison: {},
      recommendations: []
    };

    // Compare performance data if available
    if (latestResult.steps.performance_analysis?.success) {
      const perfData = latestResult.steps.performance_analysis.result.results;
      
      report.dataComparison.performance = {
        browser: perfData.browser?.success ? 'available' : 'failed',
        cerebrate: perfData.cerebrate ? 'available' : 'not_available'
      };
      
      if (perfData.browser?.success && perfData.cerebrate) {
        report.recommendations.push('Performance data available from both sources - consider cross-validation');
      } else if (!perfData.cerebrate) {
        report.recommendations.push('Consider using Cerebrate for enhanced performance monitoring');
      }
    }

    // Compare accessibility data if available
    if (latestResult.steps.accessibility_analysis?.success) {
      const a11yData = latestResult.steps.accessibility_analysis.result.results;
      
      report.dataComparison.accessibility = {
        browser: a11yData.browser?.success ? 'available' : 'failed',
        cerebrate: a11yData.cerebrate ? 'available' : 'not_available'
      };
    }

    // General recommendations
    if (!this.cerebrateIntegration?.isConnected()) {
      report.recommendations.push('Consider integrating Cerebrate for real-time debugging capabilities');
    }
    
    if (latestResult.errors.length > 0) {
      report.recommendations.push('Review workflow errors and consider error recovery strategies');
    }

    return report;
  }

  /**
   * Get workflow results
   * @returns {Array} - Array of workflow results
   */
  getResults() {
    return [...this.results];
  }

  /**
   * Get active debugging sessions
   * @returns {Array} - Array of active sessions
   */
  getActiveDebuggingSessions() {
    return Array.from(this.debuggingSessions.entries()).map(([id, session]) => ({
      id,
      ...session
    }));
  }
}

export { FrontendDebuggingWorkflow };