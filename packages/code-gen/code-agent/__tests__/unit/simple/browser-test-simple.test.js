/**
 * Simple Browser Test
 * Basic test to verify browser testing phase initialization
 */

import { jest } from '@jest/globals';
import { BrowserTestingPhase } from '../../../src/agent/phases/BrowserTestingPhase.js';

describe('Browser Testing Phase Basic', () => {
  let mockCodeAgent;
  let browserPhase;

  beforeEach(() => {
    // Create mock code agent with minimal required methods
    mockCodeAgent = {
      config: {
        browser: {
          browserType: 'chromium',
          headless: true,
          timeout: 10000
        }
      },
      emit: jest.fn()
    };

    browserPhase = new BrowserTestingPhase(mockCodeAgent);
  });

  afterEach(async () => {
    if (browserPhase && browserPhase.browser) {
      try {
        await browserPhase.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  test('should initialize BrowserTestingPhase with mock agent', () => {
    expect(browserPhase).toBeDefined();
    expect(browserPhase.browser).toBeDefined();
    expect(browserPhase.testResults).toEqual([]);
    expect(browserPhase.screenshots).toEqual([]);
    expect(browserPhase.extractedData).toEqual([]);
    expect(browserPhase.logs).toEqual([]);
  });

  test('should start session successfully', async () => {
    await browserPhase.startSession();
    
    expect(browserPhase.sessionStarted).toBeInstanceOf(Date);
    expect(mockCodeAgent.emit).toHaveBeenCalledWith('phase-start', {
      phase: 'browser-testing',
      message: 'Starting browser testing session',
      emoji: '🌐'
    });
    expect(mockCodeAgent.emit).toHaveBeenCalledWith('info', {
      message: 'Browser testing session initialized'
    });
  });

  test('should generate empty testing report initially', () => {
    const report = browserPhase.generateTestingReport();
    
    expect(report.summary.totalTests).toBe(0);
    expect(report.summary.passedTests).toBe(0);
    expect(report.summary.failedTests).toBe(0);
    expect(report.summary.successRate).toBe('0%');
    expect(report.testResults).toEqual([]);
    expect(report.screenshots).toEqual([]);
    expect(report.extractedData).toEqual([]);
    expect(report.logs).toEqual([]);
    expect(report.generatedAt).toBeTruthy();
  });

  test('should return empty arrays for getters initially', () => {
    expect(browserPhase.getTestResults()).toEqual([]);
    expect(browserPhase.getScreenshots()).toEqual([]);
    expect(browserPhase.getExtractedData()).toEqual([]);
    expect(browserPhase.getBrowserLogs()).toEqual([]);
  });
});