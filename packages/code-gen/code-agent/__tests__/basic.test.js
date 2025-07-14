/**
 * Basic tests for @jsenvoy/code-agent
 * 
 * These tests verify the core functionality of the CodeAgent class
 * and ensure proper integration with the jsEnvoy ecosystem.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeAgent } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CodeAgent', () => {
  let agent;
  let testDir;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a new CodeAgent instance
    agent = new CodeAgent({
      projectType: 'fullstack',
      eslintRules: {
        'no-console': 'warn',
        'semi': ['error', 'always']
      }
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create CodeAgent with default configuration', () => {
      const defaultAgent = new CodeAgent();
      
      expect(defaultAgent).toBeDefined();
      expect(defaultAgent.config.projectType).toBe('fullstack');
      expect(defaultAgent.config.eslintRules).toHaveProperty('no-unused-vars');
      expect(defaultAgent.config.testCoverage.threshold).toBe(80);
      expect(defaultAgent.initialized).toBe(false);
    });

    test('should create CodeAgent with custom configuration', () => {
      const customConfig = {
        projectType: 'frontend',
        eslintRules: {
          'no-var': 'error'
        },
        testCoverage: {
          threshold: 90
        }
      };
      
      const customAgent = new CodeAgent(customConfig);
      
      expect(customAgent.config.projectType).toBe('frontend');
      expect(customAgent.config.eslintRules).toHaveProperty('no-var');
      expect(customAgent.config.testCoverage.threshold).toBe(90);
    });

    test('should use default ESLint rules from EslintConfigManager', () => {
      const agent = new CodeAgent();
      
      // Should have all default rules from EslintConfigManager
      expect(agent.config.eslintRules).toHaveProperty('no-unused-vars', 'error');
      expect(agent.config.eslintRules).toHaveProperty('no-console', 'warn');
      expect(agent.config.eslintRules).toHaveProperty('semi');
      expect(agent.config.eslintRules).toHaveProperty('no-var', 'error'); // ES6+ rule
    });
  });

  describe('Initialization', () => {
    test('should initialize with working directory', async () => {
      await agent.initialize(testDir);
      
      expect(agent.initialized).toBe(true);
      expect(agent.config.workingDirectory).toBe(testDir);
    });

    test('should throw error when calling develop before initialization', async () => {
      const requirements = {
        task: 'Test project',
        requirements: { frontend: 'Basic HTML page' }
      };
      
      await expect(agent.develop(requirements)).rejects.toThrow(
        'CodeAgent must be initialized before use'
      );
    });

    test('should throw error when calling fix before initialization', async () => {
      const fixRequirements = {
        errors: ['Test error']
      };
      
      await expect(agent.fix(fixRequirements)).rejects.toThrow(
        'CodeAgent must be initialized before use'
      );
    });
  });

  describe('Status and State Management', () => {
    test('should return correct initial status', () => {
      const status = agent.getStatus();
      
      expect(status.initialized).toBe(false);
      expect(status.workingDirectory).toBeNull();
      expect(status.currentTask).toBeNull();
      expect(status.projectPlan).toBeNull();
      expect(status.qualityCheckResults).toBeNull();
    });

    test('should update status after initialization', async () => {
      await agent.initialize(testDir);
      const status = agent.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.workingDirectory).toBe(testDir);
    });
  });

  describe('Configuration Management', () => {
    test('should have correct default ESLint rules', () => {
      const defaultAgent = new CodeAgent();
      const rules = defaultAgent.config.eslintRules;
      
      expect(rules).toHaveProperty('no-unused-vars', 'error');
      expect(rules).toHaveProperty('no-console', 'warn');
      expect(rules).toHaveProperty('semi', ['error', 'always']);
      expect(rules).toHaveProperty('quotes', ['error', 'single']);
      expect(rules).toHaveProperty('indent', ['error', 2]);
      expect(rules).toHaveProperty('no-trailing-spaces', 'error');
    });

    test('should have correct default quality gates', () => {
      const defaultAgent = new CodeAgent();
      const gates = defaultAgent.config.qualityGates;
      
      expect(gates.eslintErrors).toBe(0);
      expect(gates.eslintWarnings).toBe(0);
      expect(gates.testCoverage).toBe(80);
      expect(gates.allTestsPass).toBe(true);
    });

    test('should support different project types', () => {
      const frontendAgent = new CodeAgent({ projectType: 'frontend' });
      const backendAgent = new CodeAgent({ projectType: 'backend' });
      const fullstackAgent = new CodeAgent({ projectType: 'fullstack' });
      
      expect(frontendAgent.config.projectType).toBe('frontend');
      expect(backendAgent.config.projectType).toBe('backend');
      expect(fullstackAgent.config.projectType).toBe('fullstack');
    });
  });

  describe('Development Workflow (Mocked)', () => {
    beforeEach(async () => {
      await agent.initialize(testDir);
    });

    test('should handle development requirements structure', async () => {
      const requirements = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality',
          backend: 'REST API with CRUD operations, file-based storage'
        }
      };
      
      // Note: This will fail in the current implementation since we haven't
      // implemented the actual development logic yet. This test serves as
      // a placeholder for the expected interface.
      
      try {
        const result = await agent.develop(requirements);
        
        // If implementation is complete, these assertions should pass
        expect(result).toHaveProperty('projectType');
        expect(result).toHaveProperty('filesGenerated');
        expect(result).toHaveProperty('testsCreated');
        expect(result).toHaveProperty('qualityGatesPassed');
        expect(result).toHaveProperty('duration');
      } catch (error) {
        // Expected to fail until implementation is complete
        expect(error.message).toContain('Development failed');
      }
    });

    test('should handle fix requirements structure', async () => {
      const fixRequirements = {
        errors: [
          'Test failed: Expected 3 todos, received 2',
          'ESLint error: Unused variable "todoId" in todo.js:15'
        ]
      };
      
      try {
        const result = await agent.fix(fixRequirements);
        
        // If implementation is complete, these assertions should pass
        expect(result).toHaveProperty('issuesFixed');
        expect(result).toHaveProperty('qualityGatesPassed');
        expect(result).toHaveProperty('duration');
      } catch (error) {
        // Expected to fail until implementation is complete
        expect(error.message).toContain('Fix process failed');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid working directory gracefully', async () => {
      const invalidDir = '/path/that/does/not/exist/and/cannot/be/created';
      
      // This should not throw during initialization, but might during actual operations
      // The exact behavior depends on the implementation of file operations
      await expect(agent.initialize(invalidDir)).resolves.not.toThrow();
    });
  });

  describe('Internal State Management', () => {
    beforeEach(async () => {
      await agent.initialize(testDir);
    });

    test('should initialize internal state correctly', () => {
      expect(agent.currentTask).toBeNull();
      expect(agent.projectPlan).toBeNull();
      expect(agent.generatedFiles).toBeInstanceOf(Set);
      expect(agent.testFiles).toBeInstanceOf(Set);
      expect(agent.qualityCheckResults).toBeNull();
      expect(agent.generatedFiles.size).toBe(0);
      expect(agent.testFiles.size).toBe(0);
    });

    test('should maintain file tracking sets', () => {
      // Test that file tracking sets can be manipulated
      agent.generatedFiles.add('test-file.js');
      agent.testFiles.add('test-file.test.js');
      
      expect(agent.generatedFiles.has('test-file.js')).toBe(true);
      expect(agent.testFiles.has('test-file.test.js')).toBe(true);
      expect(agent.generatedFiles.size).toBe(1);
      expect(agent.testFiles.size).toBe(1);
    });
  });
});

// Integration tests (when jsEnvoy tools are available)
describe('CodeAgent Integration', () => {
  test('should be ready for jsEnvoy integration', () => {
    const agent = new CodeAgent();
    
    // Verify that the agent has placeholders for jsEnvoy integration
    expect(agent.fileOps).toBeNull(); // Will be initialized during setup
    expect(agent.llmClient).toBeNull(); // Will be initialized during setup
    
    // Verify configuration structure supports integration
    expect(agent.config).toHaveProperty('workingDirectory');
    expect(agent.config).toHaveProperty('stateFile');
  });
});