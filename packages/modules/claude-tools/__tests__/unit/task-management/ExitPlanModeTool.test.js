/**
 * Unit tests for ExitPlanModeTool
 */

import { ExitPlanModeTool } from '../../../src/task-management/ExitPlanModeTool.js';
import { jest } from '@jest/globals';

describe('ExitPlanModeTool', () => {
  let tool;

  beforeEach(() => {
    tool = new ExitPlanModeTool();
  });

  describe('constructor', () => {
    it('should create tool with correct metadata', () => {
      expect(tool.name).toBe('ExitPlanMode');
      expect(tool.description).toBe('Exit plan mode and present implementation plan to user for approval');
    });

    it('should initialize with plan mode off', () => {
      expect(tool.isInPlanMode).toBe(false);
    });
  });

  describe('exitPlanMode', () => {
    it('should exit plan mode and format plan', async () => {
      const input = {
        plan: '1. Implement feature\n2. Write tests\n3. Update documentation'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.plan).toContain('## Implementation Plan');
      expect(result.data.plan).toContain('1. Implement feature');
      expect(result.data.message).toContain('Plan mode exited');
      expect(tool.isInPlanMode).toBe(false);
    });

    it('should preserve existing markdown headers', async () => {
      const input = {
        plan: '## My Custom Plan\n\n- Step 1\n- Step 2'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.plan).toContain('## My Custom Plan');
      expect(result.data.plan).not.toContain('## Implementation Plan\n\n##');
    });

    it('should add footer if not present', async () => {
      const input = {
        plan: 'Simple plan without footer'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.plan).toContain('Ready to proceed with implementation');
    });

    it('should not add footer if approval mentioned', async () => {
      const input = {
        plan: 'Plan with approval note already included'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.plan).toContain('approval');
      expect(result.data.plan).not.toContain('Ready to proceed');
    });

    it('should normalize excessive line breaks', async () => {
      const input = {
        plan: 'Step 1\n\n\n\nStep 2\n\n\n\n\nStep 3'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.plan).not.toContain('\n\n\n');
      expect(result.data.plan).toContain('Step 1\n\nStep 2\n\nStep 3');
    });

    it('should include plan metadata', async () => {
      const input = {
        plan: '# Markdown Plan\n\n- Item 1\n- Item 2\n\nMultiple lines here'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.metadata).toBeDefined();
      expect(result.data.metadata.plan_length).toBeGreaterThan(0);
      expect(result.data.metadata.line_count).toBeGreaterThan(1);
      expect(result.data.metadata.has_markdown).toBe(true);
    });

    it('should validate plan is not empty', async () => {
      const input = {
        plan: ''
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(false);
      // Validation error could be in data or error field
      expect(result.data || result.error).toBeDefined();
    });

    it('should include timestamp', async () => {
      const input = {
        plan: 'Test plan'
      };

      const result = await tool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.timestamp).toBeDefined();
      expect(new Date(result.data.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('helper methods', () => {
    it('should enter plan mode', () => {
      expect(tool.getIsInPlanMode()).toBe(false);
      tool.enterPlanMode();
      expect(tool.getIsInPlanMode()).toBe(true);
    });

    it('should exit plan mode after exitPlanMode', async () => {
      tool.enterPlanMode();
      expect(tool.getIsInPlanMode()).toBe(true);

      const result = await tool.execute({
        plan: 'Test plan'
      });

      expect(result.success).toBe(true);
      expect(tool.getIsInPlanMode()).toBe(false);
    });
  });

  describe('formatPlan', () => {
    it('should format plan correctly', () => {
      const plan = 'Simple plan';
      const formatted = tool.formatPlan(plan);

      expect(formatted).toContain('## Implementation Plan');
      expect(formatted).toContain('Simple plan');
      expect(formatted).toContain('Ready to proceed');
    });

    it('should handle markdown plan', () => {
      const plan = '### Steps\n1. First\n2. Second';
      const formatted = tool.formatPlan(plan);

      expect(formatted).toContain('### Steps');
      expect(formatted).not.toContain('## Implementation Plan\n\n###');
    });
  });

  describe('getToolMetadata', () => {
    it('should return complete metadata', () => {
      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('ExitPlanMode');
      expect(metadata.description).toBe('Exit plan mode and present implementation plan to user for approval');
      expect(metadata.input).toBeDefined();
      expect(metadata.input.plan).toBeDefined();
      expect(metadata.input.plan.required).toBe(true);
      expect(metadata.output).toBeDefined();
      expect(metadata.output.plan).toBeDefined();
      expect(metadata.output.metadata).toBeDefined();
    });
  });
});