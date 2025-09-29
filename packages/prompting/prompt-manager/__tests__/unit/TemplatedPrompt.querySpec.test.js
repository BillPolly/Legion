/**
 * Unit tests for TemplatedPrompt querySpec functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TemplatedPrompt } from '../../src/TemplatedPrompt.js';
import { SimpleObjectHandle, SimpleObjectDataSource } from '@legion/handle';

describe('TemplatedPrompt querySpec', () => {
  let mockLlmClient;
  let testSchema;

  beforeEach(() => {
    mockLlmClient = {
      complete: jest.fn().mockResolvedValue('{"result": "test response"}')
    };

    testSchema = {
      type: 'object',
      properties: {
        result: { type: 'string' }
      },
      required: ['result']
    };
  });

  describe('Basic querySpec functionality', () => {
    it('should extract data from Handle object using querySpec bindings', async () => {
      const querySpec = {
        bindings: {
          taskName: { path: 'task.name' },
          priority: { path: 'task.priority' },
          description: { path: 'task.description' }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Task: {{taskName}}\nPriority: {{priority}}\nDescription: {{description}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      // Create test data and Handle
      const testData = {
        task: {
          name: 'Create API',
          priority: 'high',
          description: 'Build REST API with authentication'
        }
      };
      // Wrap in array for SimpleObjectDataSource
      const dataSource = new SimpleObjectDataSource([testData]);
      const handle = new SimpleObjectHandle(dataSource);

      // Execute with Handle
      const result = await templatedPrompt.execute(handle);

      // Verify LLM was called with extracted data
      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Task: Create API');
      expect(callArgs).toContain('Priority: high');
      expect(callArgs).toContain('Description: Build REST API with authentication');
    });

    it('should extract data from plain object using querySpec bindings', async () => {
      const querySpec = {
        bindings: {
          userName: { path: 'user.name' },
          email: { path: 'user.email' }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'User: {{userName}} ({{email}})',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      // Execute with plain object (should be converted to Handle internally)
      const testData = {
        user: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };

      const result = await templatedPrompt.execute(testData);

      // Verify LLM was called with extracted data
      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('User: John Doe (john@example.com)');
    });
  });

  describe('Binding features', () => {
    it('should use fallback values when path not found', async () => {
      const querySpec = {
        bindings: {
          status: { 
            path: 'task.status',
            fallback: 'pending'
          },
          assignee: {
            path: 'task.assignee',
            fallback: 'unassigned'
          }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Status: {{status}}, Assignee: {{assignee}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      // Test data with missing fields
      const testData = { task: { name: 'Test task' } };
      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Status: pending');
      expect(callArgs).toContain('Assignee: unassigned');
    });

    it('should apply transforms to extracted values', async () => {
      const querySpec = {
        bindings: {
          title: { 
            path: 'task.title',
            transform: 'uppercase'
          },
          description: {
            path: 'task.description',
            transform: 'truncate',
            options: { maxLength: 20 }
          },
          tags: {
            path: 'task.tags',
            transform: 'join',
            options: { separator: ' | ' }
          }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Title: {{title}}\nDescription: {{description}}\nTags: {{tags}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = {
        task: {
          title: 'build api server',
          description: 'Create a comprehensive REST API server with authentication',
          tags: ['backend', 'api', 'node.js']
        }
      };

      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Title: BUILD API SERVER');
      expect(callArgs).toContain('Description: Create a comprehe...');
      expect(callArgs).toContain('Tags: backend | api | node.js');
    });

    it('should apply filters to array values', async () => {
      const querySpec = {
        bindings: {
          activeUsers: {
            path: 'users',
            filter: { status: 'active' },
            transform: 'join',
            options: { separator: ', ' }
          }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Active users: {{activeUsers}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = {
        users: [
          { name: 'Alice', status: 'active' },
          { name: 'Bob', status: 'inactive' },
          { name: 'Charlie', status: 'active' }
        ]
      };

      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      // Filter should have selected only active users and joined their names
      expect(callArgs).toMatch(/Active users:.*Alice.*Charlie/);
      expect(callArgs).not.toContain('Bob');
    });

    it('should use direct values when specified', async () => {
      const querySpec = {
        bindings: {
          systemName: { value: 'Legion Framework' },
          version: { value: '2.0.0' },
          dynamicData: { path: 'task.data' }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'System: {{systemName}} v{{version}}\nData: {{dynamicData}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = { task: { data: 'extracted value' } };
      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('System: Legion Framework v2.0.0');
      expect(callArgs).toContain('Data: extracted value');
    });
  });

  describe('Context variables', () => {
    it('should process context variables with @ prefix', async () => {
      const querySpec = {
        bindings: {
          taskName: { path: 'task.name' }
        },
        contextVariables: {
          environment: { value: 'production' },
          timestamp: { path: 'metadata.created' },
          user: { value: 'system' }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Task: {{taskName}}\nEnvironment: {{@environment}}\nCreated: {{@timestamp}}\nBy: {{@user}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = {
        task: { name: 'Deploy service' },
        metadata: { created: '2024-01-15' }
      };

      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Task: Deploy service');
      expect(callArgs).toContain('Environment: production');
      expect(callArgs).toContain('Created: 2024-01-15');
      expect(callArgs).toContain('By: system');
    });
  });

  describe('Aggregation', () => {
    it('should process aggregation bindings', async () => {
      const querySpec = {
        bindings: {
          summary: {
            aggregate: [
              { path: 'task.title', weight: 3 },
              { path: 'task.description', weight: 2 },
              { path: 'task.notes', weight: 1 }
            ]
          }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Summary: {{summary}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = {
        task: {
          title: 'Build API',
          description: 'REST API development',
          notes: 'Include authentication'
        }
      };

      const result = await templatedPrompt.execute(testData);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Build API (50% weight)');
      expect(callArgs).toContain('REST API development (33% weight)');
      expect(callArgs).toContain('Include authentication (17% weight)');
    });
  });

  describe('Error handling', () => {
    it('should handle missing required fields in strict mode', async () => {
      const querySpec = {
        bindings: {
          requiredField: { 
            path: 'missing.field',
            required: true
          }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Required: {{requiredField}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = { task: { name: 'test' } };

      await expect(templatedPrompt.execute(testData, { strict: true }))
        .rejects.toThrow('Required binding path not found: missing.field');
    });

    it('should handle missing fields gracefully in non-strict mode', async () => {
      const querySpec = {
        bindings: {
          optionalField: { path: 'missing.field' }
        }
      };

      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Optional: {{optionalField}}',
        responseSchema: testSchema,
        llmClient: mockLlmClient,
        querySpec
      });

      const testData = { task: { name: 'test' } };
      const result = await templatedPrompt.execute(testData); // non-strict by default

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Optional: '); // Should be empty/undefined
    });
  });

  describe('Backwards compatibility', () => {
    it('should work without querySpec (original behavior)', async () => {
      const templatedPrompt = new TemplatedPrompt({
        prompt: 'Hello {{name}}, welcome to {{place}}!',
        responseSchema: testSchema,
        llmClient: mockLlmClient
        // No querySpec
      });

      const placeholderValues = { name: 'John', place: 'Legion' };
      const result = await templatedPrompt.execute(placeholderValues);

      expect(mockLlmClient.complete).toHaveBeenCalled();
      const callArgs = mockLlmClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('Hello John, welcome to Legion!');
    });
  });
});