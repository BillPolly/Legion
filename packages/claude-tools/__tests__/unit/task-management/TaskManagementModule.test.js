/**
 * Unit tests for TaskManagementModule
 */

import { TaskManagementModule } from '../../../src/task-management/TaskManagementModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { jest } from '@jest/globals';

describe('TaskManagementModule', () => {
  let module;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = ResourceManager.getInstance();
    module = await TaskManagementModule.create(resourceManager);
  });

  describe('create', () => {
    it('should create module with correct metadata', () => {
      expect(module.name).toBe('task-management');
      expect(module.description).toBe('Task planning, tracking, and agent delegation tools');
    });

    it('should register all task management tools', () => {
      const tools = module.listTools();
      expect(tools).toContain('Task');
      expect(tools).toContain('TodoWrite');
      expect(tools).toContain('ExitPlanMode');
      expect(tools.length).toBe(3);
    });
  });

  describe('getTool', () => {
    it('should get Task tool', () => {
      const tool = module.getTool('Task');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('Task');
    });

    it('should get TodoWrite tool', () => {
      const tool = module.getTool('TodoWrite');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('TodoWrite');
    });

    it('should get ExitPlanMode tool', () => {
      const tool = module.getTool('ExitPlanMode');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('ExitPlanMode');
    });
  });

  describe('getMetadata', () => {
    it('should return complete module metadata', () => {
      const metadata = module.getMetadata();
      
      expect(metadata.name).toBe('task-management');
      expect(metadata.description).toBe('Task planning, tracking, and agent delegation tools');
      expect(metadata.tools).toBeInstanceOf(Array);
      expect(metadata.tools.length).toBe(3);
      
      const toolNames = metadata.tools.map(t => t.name);
      expect(toolNames).toContain('Task');
      expect(toolNames).toContain('TodoWrite');
      expect(toolNames).toContain('ExitPlanMode');
    });
  });

  describe('executeTool', () => {
    it('should execute Task tool', async () => {
      const result = await module.executeTool('Task', {
        description: 'Test task',
        prompt: 'Execute test',
        subagent_type: 'general-purpose'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.task_id).toBeDefined();
      expect(result.data.agent_type).toBe('general-purpose');
    });

    it('should execute TodoWrite tool', async () => {
      const result = await module.executeTool('TodoWrite', {
        todos: [
          { content: 'Test todo', status: 'pending', id: 'test-1' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.todos).toHaveLength(1);
      expect(result.data.summary.total).toBe(1);
    });

    it('should execute ExitPlanMode tool', async () => {
      const result = await module.executeTool('ExitPlanMode', {
        plan: 'Test implementation plan'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.plan).toContain('Test implementation plan');
      expect(result.data.message).toContain('Plan mode exited');
    });

    it('should handle validation errors', async () => {
      const result = await module.executeTool('Task', {
        description: 'ab', // Too short
        prompt: 'test',
        subagent_type: 'general-purpose'
      });

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });
  });
});