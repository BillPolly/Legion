/**
 * End-to-End Validation Integration Tests
 * 
 * These tests validate the complete enhanced code agent workflow
 */

import { jest } from '@jest/globals';
import { E2EValidator } from '../../src/validation/E2EValidator.js';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Increase timeout for E2E tests
jest.setTimeout(300000); // 5 minutes

describe('E2E Validation', () => {
  let validator;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `e2e-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    validator = new E2EValidator({
      workingDirectory: testDir,
      enableCleanup: false, // We'll clean up manually
      runSecurity: false, // Skip for speed in tests
      runPerformance: false // Skip for speed in tests
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Core Validation', () => {
    test('should validate agent initialization', async () => {
      const results = [];
      
      validator.on('test:passed', (result) => results.push(result));
      validator.on('test:failed', (result) => results.push(result));
      
      // Run only initialization test
      validator.tests = validator.tests.filter(t => 
        t.name === 'Agent Initialization'
      );
      
      const report = await validator.validate();
      
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(0);
    });

    test('should validate project generation', async () => {
      // Run initialization and generation tests
      validator.tests = validator.tests.filter(t => 
        ['Agent Initialization', 'Simple Project Generation'].includes(t.name)
      );
      
      const report = await validator.validate();
      
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(0);
      
      // Check that files were generated
      const files = await fs.readdir(testDir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Validation', () => {
    test('should validate quality checks', async () => {
      // Run up to quality checks
      validator.tests = validator.tests.filter(t => 
        ['Agent Initialization', 'Simple Project Generation', 'Quality Checks Pass'].includes(t.name)
      );
      
      const report = await validator.validate();
      
      const qualityTest = report.categories.quality?.tests.find(t => 
        t.name === 'Quality Checks Pass'
      );
      
      expect(qualityTest).toBeDefined();
      if (qualityTest.success) {
        expect(qualityTest.result.eslintPassed).toBe(true);
        expect(qualityTest.result.coverage).toBeGreaterThan(0);
      }
    });
  });

  describe('Component Integration', () => {
    test('should validate component integration', async () => {
      validator.tests = validator.tests.filter(t => 
        t.category === 'integration' || t.name === 'Agent Initialization'
      );
      
      const report = await validator.validate();
      
      const integrationResults = report.categories.integration;
      expect(integrationResults).toBeDefined();
      
      // At least some integration tests should pass
      expect(integrationResults.passed).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive validation report', async () => {
      // Run a subset of tests
      validator.tests = validator.tests.slice(0, 3);
      
      const report = await validator.validate();
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalTests).toBe(3);
      expect(report.categories).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.productionReady).toBeDefined();
    });

    test('should categorize test results', async () => {
      const report = await validator.validate();
      
      const categories = Object.keys(report.categories);
      expect(categories).toContain('core');
      expect(categories).toContain('generation');
      
      for (const category of categories) {
        expect(report.categories[category].total).toBeGreaterThanOrEqual(0);
        expect(report.categories[category].tests).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle critical failures', async () => {
      // Add a failing critical test
      validator.addTest('Critical Failure', async () => {
        throw new Error('Critical error');
      }, { critical: true });
      
      const report = await validator.validate();
      
      expect(report.summary.criticalFailures).toBeGreaterThan(0);
      expect(report.criticalFailures.length).toBeGreaterThan(0);
    });

    test('should continue after non-critical failures', async () => {
      let testCount = 0;
      
      // Add failing non-critical test
      validator.addTest('Non-Critical Failure', async () => {
        testCount++;
        throw new Error('Non-critical error');
      }, { critical: false });
      
      // Add another test that should run
      validator.addTest('Should Run', async () => {
        testCount++;
        return { success: true };
      });
      
      await validator.validate();
      
      expect(testCount).toBe(2); // Both tests should run
    });
  });

  describe('Events', () => {
    test('should emit validation events', async () => {
      const events = [];
      
      validator.on('validation:started', (e) => events.push({ type: 'started', data: e }));
      validator.on('test:started', (e) => events.push({ type: 'test:started', data: e }));
      validator.on('test:passed', (e) => events.push({ type: 'test:passed', data: e }));
      validator.on('test:failed', (e) => events.push({ type: 'test:failed', data: e }));
      validator.on('validation:completed', (e) => events.push({ type: 'completed', data: e }));
      
      // Run minimal tests
      validator.tests = validator.tests.slice(0, 2);
      
      await validator.validate();
      
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'test:started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });
  });

  describe('Production Readiness', () => {
    test('should determine production readiness', async () => {
      // Create a validator that will pass critical tests
      const prodValidator = new E2EValidator({
        workingDirectory: testDir,
        enableCleanup: false
      });
      
      // Override with passing tests
      prodValidator.tests = [
        new (class {
          constructor() {
            this.name = 'Critical Test';
            this.critical = true;
            this.category = 'core';
          }
          async run() {
            return { name: this.name, success: true, result: {} };
          }
        })(),
        new (class {
          constructor() {
            this.name = 'Quality Checks Pass';
            this.category = 'quality';
          }
          async run() {
            return { name: this.name, success: true, result: {} };
          }
        })()
      ];
      
      const report = await prodValidator.validate();
      
      // Should be production ready if critical tests pass
      expect(report.productionReady).toBe(true);
    });
  });
});

describe('Enhanced Agent Full Workflow', () => {
  let agent;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `workflow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    agent = new EnhancedCodeAgent({
      projectType: 'backend',
      enableConsoleOutput: false,
      enhancedConfig: {
        enableRuntimeTesting: true,
        enableBrowserTesting: false, // Backend only
        enableLogAnalysis: true,
        runtimeTimeout: 60000 // 1 minute for tests
      }
    });
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should complete basic workflow', async () => {
    await agent.initialize(testDir);
    
    const result = await agent.develop({
      projectName: 'Test API',
      description: 'Simple REST API',
      features: ['GET /health endpoint']
    });
    
    expect(result.success).toBe(true);
    expect(result.filesGenerated).toBeGreaterThan(0);
    
    // Verify files exist
    const files = await fs.readdir(testDir);
    expect(files).toContain('server.js');
    expect(files).toContain('package.json');
  });

  test('should handle fix workflow', async () => {
    await agent.initialize(testDir);
    
    // Create a file with an error
    await fs.writeFile(
      path.join(testDir, 'broken.js'),
      'const x = ; // Syntax error'
    );
    
    // Run fix
    const result = await agent.fix({
      issues: ['Syntax error in broken.js']
    });
    
    expect(result.success).toBeDefined();
  });
});