/**
 * Unit tests for TaskTool
 */

import { TaskTool } from '../../../src/task-management/TaskTool.js';
import { jest } from '@jest/globals';

describe('TaskTool', () => {
  let tool;

  beforeEach(() => {
    tool = new TaskTool();
  });

  describe('constructor', () => {
    it('should create tool with correct metadata', () => {
      expect(tool.name).toBe('Task');
      expect(tool.description).toBe('Launch a new agent to handle complex, multi-step tasks autonomously');
    });
  });

  describe('executeTask', () => {
    it('should execute general-purpose agent task', async () => {
      const input = {
        description: 'Search for code',
        prompt: 'Find all React components in the codebase',
        subagent_type: 'general-purpose'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.task_id).toBeDefined();
      expect(result.data.description).toBe('Search for code');
      expect(result.data.agent_type).toBe('general-purpose');
      expect(result.data.result).toContain('General-purpose agent');
      expect(result.data.metadata.capabilities).toContain('research');
    });

    it('should execute context-fetcher agent task', async () => {
      const input = {
        description: 'Fetch docs',
        prompt: 'Get Agent OS documentation',
        subagent_type: 'context-fetcher'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.agent_type).toBe('context-fetcher');
      expect(result.data.result).toContain('Context-fetcher agent');
      expect(result.data.metadata.capabilities).toContain('read');
      expect(result.data.metadata.capabilities).toContain('grep');
    });

    it('should execute file-creator agent task', async () => {
      const input = {
        description: 'Create files',
        prompt: 'Create a new React component',
        subagent_type: 'file-creator'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.agent_type).toBe('file-creator');
      expect(result.data.result).toContain('File-creator agent');
      expect(result.data.metadata.capabilities).toContain('write');
    });

    it('should execute git-workflow agent task', async () => {
      const input = {
        description: 'Git operations',
        prompt: 'Create a new branch and commit',
        subagent_type: 'git-workflow'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.agent_type).toBe('git-workflow');
      expect(result.data.result).toContain('Git-workflow agent');
      expect(result.data.metadata.capabilities).toContain('bash');
    });

    it('should execute test-runner agent task', async () => {
      const input = {
        description: 'Run tests',
        prompt: 'Execute unit tests and analyze failures',
        subagent_type: 'test-runner'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.agent_type).toBe('test-runner');
      expect(result.data.result).toContain('Test-runner agent');
      expect(result.data.metadata.capabilities).toContain('glob');
    });

    it('should validate description length', async () => {
      const input = {
        description: 'ab', // Too short
        prompt: 'Test prompt',
        subagent_type: 'general-purpose'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });

    it('should validate agent type', async () => {
      const input = {
        description: 'Test task',
        prompt: 'Test prompt',
        subagent_type: 'invalid-type'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });

    it('should include execution metadata', async () => {
      const input = {
        description: 'Test task',
        prompt: 'Test prompt',
        subagent_type: 'general-purpose'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.metadata).toBeDefined();
      expect(result.data.metadata.task_id).toBeDefined();
      expect(result.data.metadata.started_at).toBeDefined();
      expect(result.data.metadata.completed_at).toBeDefined();
      expect(result.data.metadata.execution_time_ms).toBeDefined();
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('Task');
      expect(metadata.description).toBe('Launch a new agent to handle complex, multi-step tasks autonomously');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties).toBeDefined();
      expect(metadata.inputSchema.properties.description).toBeDefined();
      expect(metadata.inputSchema.required).toContain('description');
      expect(metadata.inputSchema.properties.prompt).toBeDefined();
      expect(metadata.inputSchema.properties.subagent_type).toBeDefined();
      expect(metadata.inputSchema.properties.subagent_type.enum).toBeInstanceOf(Array);
      expect(metadata.outputSchema).toBeDefined();
      expect(metadata.outputSchema.properties.task_id).toBeDefined();
    });
  });
});