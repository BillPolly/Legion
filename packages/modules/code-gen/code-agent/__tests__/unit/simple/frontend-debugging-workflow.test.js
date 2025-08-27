/**
 * Frontend Debugging Workflow Test
 * Demonstrates the complete integration of Playwright browser automation
 * with Cerebrate Chrome DevTools extension capabilities
 */

import { jest } from '@jest/globals';
import { FrontendDebuggingWorkflow } from '../../../src/workflows/FrontendDebuggingWorkflow.js';

describe('Frontend Debugging Workflow', () => {
  let mockCodeAgent;
  let mockBrowserPhase;
  let workflow;

  beforeEach(async () => {
    // Mock browser testing phase
    mockBrowserPhase = {
      startSession: jest.fn().mockResolvedValue({}),
      navigateAndValidate: jest.fn().mockResolvedValue({
        success: true,
        status: 200,
        url: 'https://example.com',
        title: 'Example Domain',
        timestamp: new Date().toISOString()
      }),
      captureScreenshot: jest.fn().mockResolvedValue({
        success: true,
        screenshot: 'base64-data',
        format: 'png',
        timestamp: new Date().toISOString()
      }),
      extractPageData: jest.fn().mockResolvedValue({
        success: true,
        data: {
          title: { text: 'Example Domain' },
          headings: [{ text: 'Example Domain' }],
          links: [{ text: 'More information...' }]
        },
        url: 'https://example.com'
      }),
      executeJavaScript: jest.fn().mockResolvedValue({
        success: true,
        result: JSON.stringify({
          navigation: {
            domContentLoaded: 150,
            loadComplete: 300,
            totalTime: 450
          },
          paint: {
            firstPaint: 120,
            firstContentfulPaint: 180
          },
          resources: {
            totalResources: 15,
            totalSize: 245000
          }
        })
      }),
      getBrowserLogs: jest.fn().mockReturnValue([
        {
          type: 'navigation',
          action: 'navigate',
          success: true,
          timestamp: new Date().toISOString()
        },
        {
          type: 'javascript',
          action: 'execute',
          success: false,
          error: 'Test error',
          timestamp: new Date().toISOString()
        }
      ]),
      cleanup: jest.fn().mockResolvedValue({})
    };

    // Mock code agent
    mockCodeAgent = {
      config: {
        browser: {
          browserType: 'chromium',
          headless: true
        }
      },
      browserTestingPhase: mockBrowserPhase,
      emit: jest.fn()
    };

    workflow = new FrontendDebuggingWorkflow(mockCodeAgent);
  });

  afterEach(async () => {
    // Cleanup
    if (workflow.cerebrateIntegration) {
      try {
        await workflow.cerebrateIntegration.disconnect();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('should initialize workflow without Cerebrate integration', async () => {
    expect(workflow).toBeDefined();
    expect(workflow.codeAgent).toBe(mockCodeAgent);
    expect(workflow.browserPhase).toBe(mockBrowserPhase);
    expect(workflow.cerebrateIntegration).toBeNull();
  });

  test('should run browser-only debugging workflow successfully', async () => {
    const workflowConfig = {
      useCerebrate: false, // Force browser-only mode
      takeScreenshots: true,
      analyzePerformance: true,
      checkAccessibility: true,
      captureErrors: true,
      extractContent: true
    };

    const result = await workflow.runDebuggingWorkflow('https://example.com', workflowConfig);

    // Verify workflow completed successfully
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com');
    expect(result.duration).toBeDefined();

    // Verify all steps were executed
    expect(result.steps.browser_init.success).toBe(true);
    expect(result.steps.browser_navigation.success).toBe(true);
    expect(result.steps.screenshot_capture.success).toBe(true);
    expect(result.steps.content_extraction.success).toBe(true);
    expect(result.steps.performance_analysis.success).toBe(true);
    expect(result.steps.accessibility_analysis.success).toBe(true);
    expect(result.steps.error_capture.success).toBe(true);

    // Verify browser phase methods were called
    expect(mockBrowserPhase.startSession).toHaveBeenCalled();
    expect(mockBrowserPhase.navigateAndValidate).toHaveBeenCalledWith('https://example.com');
    expect(mockBrowserPhase.captureScreenshot).toHaveBeenCalled();
    expect(mockBrowserPhase.extractPageData).toHaveBeenCalled();
    expect(mockBrowserPhase.executeJavaScript).toHaveBeenCalled();
    expect(mockBrowserPhase.getBrowserLogs).toHaveBeenCalled();

    // Verify code agent events were emitted
    expect(mockCodeAgent.emit).toHaveBeenCalledWith('phase-start', expect.objectContaining({
      phase: 'frontend-debugging',
      emoji: '🔍'
    }));
    expect(mockCodeAgent.emit).toHaveBeenCalledWith('phase-complete', expect.objectContaining({
      phase: 'frontend-debugging'
    }));
  }, 15000);

  test('should handle navigation errors gracefully', async () => {
    // Mock navigation failure
    mockBrowserPhase.navigateAndValidate.mockResolvedValueOnce({
      success: false,
      error: 'Connection refused'
    });

    const result = await workflow.runDebuggingWorkflow('http://invalid-url.com');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Navigation failed');
    expect(result.steps.browser_navigation.success).toBe(false);
  }, 10000);

  test('should run custom tests in workflow', async () => {
    const customTests = [
      {
        name: 'check_jquery',
        type: 'browser',
        script: () => typeof jQuery !== 'undefined'
      },
      {
        name: 'check_viewport',
        type: 'browser',
        script: () => window.innerWidth > 1000
      }
    ];

    // Mock custom test results
    mockBrowserPhase.executeJavaScript
      .mockResolvedValueOnce({ // Performance analysis
        success: true,
        result: JSON.stringify({ navigation: { totalTime: 200 } })
      })
      .mockResolvedValueOnce({ // Accessibility analysis  
        success: true,
        result: JSON.stringify({ issues: [], score: 100 })
      })
      .mockResolvedValueOnce({ // First custom test
        success: true,
        result: 'false'
      })
      .mockResolvedValueOnce({ // Second custom test
        success: true,
        result: 'true'
      });

    const workflowConfig = {
      useCerebrate: false,
      customTests
    };

    const result = await workflow.runDebuggingWorkflow('https://example.com', workflowConfig);

    expect(result.success).toBe(true);
    expect(result.steps.custom_test_check_jquery.success).toBe(true);
    expect(result.steps.custom_test_check_viewport.success).toBe(true);
    expect(mockBrowserPhase.executeJavaScript).toHaveBeenCalledTimes(4); // perf + a11y + 2 custom
  }, 10000);

  test('should generate comparison report', async () => {
    // Run a workflow first
    const result = await workflow.runDebuggingWorkflow('https://example.com', {
      useCerebrate: false
    });

    expect(result.success).toBe(true);

    // Generate comparison report
    const report = workflow.generateComparisonReport('https://example.com');

    expect(report.url).toBe('https://example.com');
    expect(report.workflow.success).toBe(true);
    expect(report.capabilities.browserAutomation.available).toBe(true);
    expect(report.capabilities.cerebrateIntegration.available).toBe(false);
    expect(report.recommendations).toContain('Consider integrating Cerebrate for real-time debugging capabilities');
  }, 10000);

  test('should track workflow results and sessions', async () => {
    expect(workflow.getResults()).toHaveLength(0);
    expect(workflow.getActiveDebuggingSessions()).toHaveLength(0);

    await workflow.runDebuggingWorkflow('https://example.com', {
      useCerebrate: false
    });

    expect(workflow.getResults()).toHaveLength(1);
    expect(workflow.getResults()[0].url).toBe('https://example.com');
  }, 10000);

  test('should handle performance analysis data correctly', async () => {
    // Mock detailed performance data
    mockBrowserPhase.executeJavaScript.mockResolvedValueOnce({
      success: true,
      result: JSON.stringify({
        navigation: {
          domContentLoaded: 150,
          loadComplete: 300,
          totalTime: 450
        },
        paint: {
          firstPaint: 120,
          firstContentfulPaint: 180
        },
        resources: {
          totalResources: 25,
          totalSize: 500000,
          slowestResource: {
            name: 'large-image.jpg',
            duration: 2000
          }
        }
      })
    });

    const result = await workflow.runDebuggingWorkflow('https://example.com', {
      useCerebrate: false,
      analyzePerformance: true,
      takeScreenshots: false,
      checkAccessibility: false,
      captureErrors: false,
      extractContent: false
    });

    expect(result.success).toBe(true);
    expect(result.steps.performance_analysis.success).toBe(true);
    
    const perfResults = result.steps.performance_analysis.result.results;
    expect(perfResults.browser.success).toBe(true);
    
    const perfData = JSON.parse(perfResults.browser.result);
    expect(perfData.navigation.totalTime).toBe(450);
    expect(perfData.resources.totalResources).toBe(25);
    expect(perfData.resources.slowestResource.name).toBe('large-image.jpg');
  }, 10000);

  test('should handle accessibility analysis correctly', async () => {
    // Mock accessibility analysis
    mockBrowserPhase.executeJavaScript
      .mockResolvedValueOnce({ // Performance (skipped)
        success: true,
        result: JSON.stringify({})
      })
      .mockResolvedValueOnce({ // Accessibility analysis
        success: true,
        result: JSON.stringify({
          issues: [
            '3 images missing alt text',
            'No H1 heading found',
            '2 form inputs without labels'
          ],
          score: 25
        })
      });

    const result = await workflow.runDebuggingWorkflow('https://example.com', {
      useCerebrate: false,
      analyzePerformance: true,
      checkAccessibility: true,
      takeScreenshots: false,
      captureErrors: false,
      extractContent: false
    });

    expect(result.success).toBe(true);
    expect(result.steps.accessibility_analysis.success).toBe(true);
    
    const a11yResults = result.steps.accessibility_analysis.result.results;
    expect(a11yResults.browser.success).toBe(true);
    
    const a11yData = JSON.parse(a11yResults.browser.result);
    expect(a11yData.issues).toHaveLength(3);
    expect(a11yData.score).toBe(25);
    expect(a11yData.issues[0]).toContain('images missing alt text');
  }, 10000);

  test('should handle error capture correctly', async () => {
    // Mock browser logs with errors
    mockBrowserPhase.getBrowserLogs.mockReturnValueOnce([
      {
        type: 'navigation',
        action: 'navigate',
        success: true,
        timestamp: new Date().toISOString()
      },
      {
        type: 'javascript',
        action: 'execute',
        success: false,
        error: 'ReferenceError: $ is not defined',
        timestamp: new Date().toISOString()
      },
      {
        type: 'javascript',
        action: 'execute',
        success: false,
        error: 'TypeError: Cannot read property of null',
        timestamp: new Date().toISOString()
      }
    ]);

    const result = await workflow.runDebuggingWorkflow('https://example.com', {
      useCerebrate: false,
      captureErrors: true,
      takeScreenshots: false,
      analyzePerformance: false,
      checkAccessibility: false,
      extractContent: false
    });

    expect(result.success).toBe(true);
    expect(result.steps.error_capture.success).toBe(true);
    
    const errorResults = result.steps.error_capture.result.results;
    expect(errorResults.browser.totalLogs).toBe(3);
    expect(errorResults.browser.errorLogs).toBe(2);
    expect(errorResults.browser.errors).toHaveLength(2);
    expect(errorResults.browser.errors[0].message).toContain('$ is not defined');
    expect(errorResults.browser.errors[1].message).toContain('Cannot read property of null');
  }, 10000);
});