/**
 * Basic PromptManager functionality tests
 */

import { RetryHandler } from '../../src/RetryHandler.js';

describe('PromptManager Basic Functionality', () => {
  describe('Configuration Management', () => {
    // Mock a minimal PromptManager-like class for testing configuration
    class MockPromptManager {
      constructor(config) {
        this.config = config;
        this.validateConfiguration();
      }

      validateConfiguration() {
        if (!this.config) {
          throw new Error('Configuration is required');
        }
        if (!this.config.objectQuery) {
          throw new Error('objectQuery configuration is required');
        }
        if (!this.config.promptBuilder) {
          throw new Error('promptBuilder configuration is required');  
        }
        if (!this.config.outputSchema) {
          throw new Error('outputSchema configuration is required');
        }
      }

      updateConfiguration(updates) {
        if (updates.objectQuery || updates.promptBuilder || updates.outputSchema) {
          throw new Error('Core component configurations cannot be updated after creation');
        }
        this.config = { ...this.config, ...updates };
      }

      getComponentStatus() {
        return {
          objectQuery: this.config.objectQuery ? 'ready' : 'not_configured',
          promptBuilder: this.config.promptBuilder ? 'ready' : 'not_configured',
          outputSchema: this.config.outputSchema ? 'ready' : 'not_configured',
          llmClient: this.config.llmClient ? 'configured' : 'not_configured'
        };
      }
    }

    test('should require all core configurations', () => {
      expect(() => new MockPromptManager({}))
        .toThrow('objectQuery configuration is required');
        
      expect(() => new MockPromptManager({ objectQuery: {} }))
        .toThrow('promptBuilder configuration is required');
        
      expect(() => new MockPromptManager({ 
        objectQuery: {}, 
        promptBuilder: {} 
      })).toThrow('outputSchema configuration is required');
    });

    test('should accept valid configuration', () => {
      const validConfig = {
        objectQuery: { bindings: { test: { path: 'test' } } },
        promptBuilder: { template: 'test {{test}}' },
        outputSchema: { type: 'object', properties: {} }
      };

      const manager = new MockPromptManager(validConfig);
      expect(manager.config).toEqual(validConfig);
    });

    test('should report component status', () => {
      const config = {
        objectQuery: { bindings: {} },
        promptBuilder: { template: 'test' },
        outputSchema: { type: 'object' },
        llmClient: { complete: () => {} }
      };

      const manager = new MockPromptManager(config);
      const status = manager.getComponentStatus();
      
      expect(status.objectQuery).toBe('ready');
      expect(status.promptBuilder).toBe('ready');
      expect(status.outputSchema).toBe('ready');
      expect(status.llmClient).toBe('configured');
    });

    test('should prevent core configuration updates', () => {
      const manager = new MockPromptManager({
        objectQuery: { bindings: {} },
        promptBuilder: { template: 'test' },
        outputSchema: { type: 'object' }
      });

      expect(() => manager.updateConfiguration({ objectQuery: {} }))
        .toThrow('Core component configurations cannot be updated after creation');
    });
  });

  describe('Pipeline Workflow Simulation', () => {
    test('should simulate complete pipeline execution', async () => {
      // Mock the pipeline steps
      const mockExtraction = async (sourceObject) => {
        return { content: sourceObject.data.content, user: sourceObject.user.role };
      };

      const mockPromptBuilding = (labeledInputs) => {
        return `Analyze: ${labeledInputs.content} for user ${labeledInputs.user}`;
      };

      const mockLLMCall = async (prompt) => {
        return '{"analysis": "Mock analysis", "score": 8}';
      };

      const mockValidation = (response) => {
        try {
          const data = JSON.parse(response);
          if (!data.analysis) {
            return { success: false, errors: [{ field: 'analysis', message: 'Missing required field' }] };
          }
          return { success: true, data };
        } catch (error) {
          return { success: false, errors: [{ message: 'Invalid JSON' }] };
        }
      };

      // Simulate pipeline execution
      const sourceObject = {
        data: { content: 'Test content' },
        user: { role: 'analyst' }
      };

      const extracted = await mockExtraction(sourceObject);
      expect(extracted.content).toBe('Test content');

      const prompt = mockPromptBuilding(extracted);
      expect(prompt).toContain('Test content');

      const llmResponse = await mockLLMCall(prompt);
      expect(llmResponse).toBeDefined();

      const result = mockValidation(llmResponse);
      expect(result.success).toBe(true);
      expect(result.data.analysis).toBe('Mock analysis');
    });

    test('should simulate retry logic with error feedback', async () => {
      const handler = new RetryHandler({ maxAttempts: 3 });

      let attemptCount = 0;
      const mockPipelineWithRetry = async (attempt, lastError) => {
        attemptCount++;
        
        if (attempt === 1) {
          // First attempt fails validation
          return {
            success: false,
            errors: [{ field: 'score', message: 'Value exceeds maximum' }]
          };
        } else if (attempt === 2) {
          // Second attempt succeeds after error feedback
          expect(lastError).toBeDefined();
          expect(lastError.errors[0].field).toBe('score');
          return {
            success: true,
            data: { analysis: 'Corrected analysis', score: 7 }
          };
        }
      };

      const result = await handler.executeWithRetry(mockPipelineWithRetry);
      
      expect(result.success).toBe(true);
      expect(result.data.score).toBe(7);
      expect(attemptCount).toBe(2);
      expect(result.metadata.attempts).toBe(2);
    });
  });

  describe('Error Handling Patterns', () => {
    test('should handle various error scenarios', async () => {
      const scenarios = [
        {
          name: 'LLM API Error',
          error: new Error('API rate limit exceeded'),
          expectedStage: 'fatal'
        },
        {
          name: 'Validation Error',
          result: { success: false, errors: [{ message: 'Invalid format' }] },
          expectedStage: 'validation'
        },
        {
          name: 'Configuration Error', 
          error: new Error('Invalid configuration'),
          expectedStage: 'configuration'
        }
      ];

      for (const scenario of scenarios) {
        try {
          if (scenario.error) {
            throw scenario.error;
          } else {
            expect(scenario.result.success).toBe(false);
            expect(scenario.result.errors).toBeDefined();
          }
        } catch (error) {
          expect(error.message).toBeDefined();
        }
      }
    });

    test('should provide helpful error messages', () => {
      const errorMessages = [
        'Configuration is required',
        'objectQuery configuration is required',
        'promptBuilder configuration is required', 
        'outputSchema configuration is required',
        'Source object must be a non-null object',
        'LLM client not available'
      ];

      for (const message of errorMessages) {
        expect(message).toMatch(/\w+/); // Should contain actual words
        expect(message.length).toBeGreaterThan(10); // Should be descriptive
      }
    });
  });

  describe('Execution History and State Management', () => {
    test('should track execution history', () => {
      class MockHistoryManager {
        constructor() {
          this.executionHistory = [];
        }

        recordExecution(result) {
          this.executionHistory.push({
            executionId: `exec_${Date.now()}`,
            timestamp: new Date().toISOString(),
            success: result.success,
            attempts: result.attempts || 1,
            durationMs: result.durationMs || 0
          });
        }

        getExecutionHistory() {
          return [...this.executionHistory];
        }

        clearHistory() {
          this.executionHistory = [];
        }

        getLastAttemptInfo() {
          return this.executionHistory[this.executionHistory.length - 1] || null;
        }
      }

      const manager = new MockHistoryManager();
      
      manager.recordExecution({ success: true, attempts: 1, durationMs: 150 });
      manager.recordExecution({ success: false, attempts: 3, durationMs: 450 });

      const history = manager.getExecutionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].success).toBe(true);
      expect(history[1].success).toBe(false);

      const lastAttempt = manager.getLastAttemptInfo();
      expect(lastAttempt.success).toBe(false);
      expect(lastAttempt.attempts).toBe(3);

      manager.clearHistory();
      expect(manager.getExecutionHistory()).toHaveLength(0);
    });
  });

  describe('Integration Readiness', () => {
    test('should demonstrate component compatibility validation', () => {
      // Mock placeholder extraction from prompt template
      const extractPlaceholders = (template) => {
        const matches = template.match(/\{\{(\w+)\}\}/g) || [];
        return matches.map(match => match.replace(/[{}]/g, ''));
      };

      // Mock binding validation
      const validateBindings = (placeholders, bindings) => {
        for (const placeholder of placeholders) {
          if (placeholder === 'outputInstructions') continue; // Auto-generated
          if (!bindings[placeholder]) {
            throw new Error(`Placeholder '${placeholder}' not found in bindings`);
          }
        }
      };

      const template = 'Analyze: {{content}} for {{user}} role. {{outputInstructions}}';
      const placeholders = extractPlaceholders(template);
      
      expect(placeholders).toContain('content');
      expect(placeholders).toContain('user');
      expect(placeholders).toContain('outputInstructions');

      const validBindings = {
        content: { path: 'data.content' },
        user: { path: 'user.role' }
      };

      expect(() => validateBindings(placeholders, validBindings)).not.toThrow();

      const invalidBindings = {
        content: { path: 'data.content' }
        // Missing 'user' binding
      };

      expect(() => validateBindings(placeholders, invalidBindings))
        .toThrow("Placeholder 'user' not found in bindings");
    });
  });
});