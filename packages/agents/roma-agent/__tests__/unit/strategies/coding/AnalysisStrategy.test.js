/**
 * Unit tests for AnalysisStrategy
 * Tests the migration of RequirementsAnalyzer component to TaskStrategy pattern
 * Phase 1.1 Migration Test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import AnalysisStrategy from '../../../../src/strategies/coding/AnalysisStrategy.js';

describe('AnalysisStrategy', () => {
  let resourceManager;
  let llmClient;
  let strategy;

  beforeEach(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
    
    // Create strategy instance
    strategy = new AnalysisStrategy(llmClient);
  });

  describe('Basic Properties', () => {
    test('should create strategy instance', () => {
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('Analysis');
    });

    test('should accept LLM client in constructor', () => {
      expect(strategy.llmClient).toBe(llmClient);
    });

    test('should initialize with default options', () => {
      expect(strategy.options.outputFormat).toBe('json');
      expect(strategy.options.validateResults).toBe(true);
    });

    test('should accept custom options', () => {
      const customStrategy = new AnalysisStrategy(llmClient, {
        outputFormat: 'text',
        validateResults: false
      });
      
      expect(customStrategy.options.outputFormat).toBe('text');
      expect(customStrategy.options.validateResults).toBe(false);
    });
  });

  describe('TaskStrategy Interface', () => {
    test('should implement getName method', () => {
      expect(typeof strategy.getName).toBe('function');
      expect(strategy.getName()).toBe('Analysis');
    });

    test('should implement onParentMessage method', () => {
      expect(typeof strategy.onParentMessage).toBe('function');
    });

    test('should implement onChildMessage method', () => {
      expect(typeof strategy.onChildMessage).toBe('function');
    });
  });

  describe('Component Wrapping', () => {
    test('should not initialize component until first use', () => {
      expect(strategy.requirementsAnalyzer).toBeNull();
    });

    test('should have extractRequirements helper method', () => {
      expect(typeof strategy._extractRequirements).toBe('function');
    });

    test('should have context extraction helper', () => {
      expect(typeof strategy._getContextFromTask).toBe('function');
    });
  });

  describe('Message Handling', () => {
    test('should handle start message', async () => {
      const mockTask = {
        description: 'Create a simple calculator API',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn(),
        complete: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      // Should return result object
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    }, 10000); // Increase timeout to 10 seconds for LLM call

    test('should handle abort message', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'abort' });
      
      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should handle unknown message types', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'unknown' });
      
      expect(result.acknowledged).toBe(true);
    });
  });

  describe('Requirements Extraction', () => {
    test('should extract requirements from task description', () => {
      const mockTask = {
        description: 'Create a REST API with authentication'
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toBe('Create a REST API with authentication');
    });

    test('should extract requirements from artifacts', () => {
      const mockTask = {
        description: '',
        getAllArtifacts: () => ({
          'requirements-spec': {
            content: 'Build a calculator application',
            type: 'text'
          }
        })
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toBe('Build a calculator application');
    });

    test('should return null when no requirements found', () => {
      const mockTask = {
        description: '',
        getAllArtifacts: () => ({})
      };

      const requirements = strategy._extractRequirements(mockTask);
      expect(requirements).toBeNull();
    });
  });
});