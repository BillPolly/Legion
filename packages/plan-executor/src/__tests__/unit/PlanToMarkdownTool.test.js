/**
 * Tests for PlanToMarkdownTool
 */

import { describe, test, expect } from '@jest/globals';
import { PlanToMarkdownTool } from '../../tools/PlanToMarkdownTool.js';

describe('PlanToMarkdownTool', () => {
  let tool;

  beforeEach(() => {
    tool = new PlanToMarkdownTool();
  });

  describe('Tool Interface', () => {
    test('should have correct name', () => {
      expect(tool.name).toBe('plan_to_markdown');
    });

    test('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description).toContain('markdown');
    });

    test('should have input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties.plan).toBeDefined();
      expect(tool.inputSchema.required).toContain('plan');
    });
  });

  describe('Parameter Validation', () => {
    test('should fail with null plan', async () => {
      const result = await tool.execute({ plan: null });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be null');
    });

    test('should fail with missing plan', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    test('should fail with non-object plan', async () => {
      const result = await tool.execute({ plan: 'not an object' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an object');
    });
  });

  describe('Basic Plan Conversion', () => {
    const simplePlan = {
      id: 'test-plan',
      name: 'Test Plan',
      description: 'A simple test plan',
      steps: [
        {
          id: 'step1',
          name: 'First Step',
          description: 'The first step',
          actions: [
            {
              id: 'action1',
              type: 'test_action',
              description: 'Test action'
            }
          ]
        }
      ]
    };

    test('should generate detailed markdown by default', async () => {
      const result = await tool.execute({ plan: simplePlan });
      
      expect(result.success).toBe(true);
      expect(result.markdown).toBeDefined();
      expect(result.format).toBe('detailed');
      expect(result.sections).toContain('overview');
      expect(result.sections).toContain('steps');
      
      // Check markdown content
      expect(result.markdown).toContain('# Test Plan');
      expect(result.markdown).toContain('A simple test plan');
      expect(result.markdown).toContain('### First Step');
      expect(result.markdown).toContain('**Actions:**');
      expect(result.markdown).toContain('- **test_action**');
    });

    test('should generate summary format', async () => {
      const result = await tool.execute({ 
        plan: simplePlan, 
        format: 'summary' 
      });
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('summary');
      expect(result.sections).toContain('overview');
      expect(result.sections).toContain('steps');
      
      expect(result.markdown).toContain('# Test Plan');
      expect(result.markdown).toContain('## Quick Overview');
      expect(result.markdown).toContain('**Total Steps**: 1');
      expect(result.markdown).toContain('**Total Actions**: 1');
    });

    test('should generate execution guide format', async () => {
      const result = await tool.execute({ 
        plan: simplePlan, 
        format: 'execution-guide' 
      });
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('execution-guide');
      expect(result.sections).toContain('prerequisites');
      expect(result.sections).toContain('execution-steps');
      
      expect(result.markdown).toContain('## Prerequisites');
      expect(result.markdown).toContain('## Execution Steps');
    });
  });

  describe('Complex Plan Features', () => {
    const complexPlan = {
      id: 'complex-plan',
      name: 'Complex Test Plan',
      description: 'A complex plan with dependencies and metadata',
      version: '1.0.0',
      metadata: {
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'test-user',
        complexity: 'high',
        profile: 'integration-test',
        requiredModules: ['module1', 'module2']
      },
      steps: [
        {
          id: 'step1',
          name: 'Setup Step',
          description: 'Initial setup',
          type: 'setup',
          dependencies: [],
          actions: [
            {
              id: 'setup-action',
              type: 'setup_environment',
              description: 'Set up test environment',
              parameters: { env: 'test' }
            }
          ]
        },
        {
          id: 'step2',
          name: 'Main Step',
          description: 'Main processing',
          type: 'processing',
          dependencies: ['step1'],
          actions: [
            {
              id: 'process-action',
              type: 'process_data',
              description: 'Process the data'
            }
          ],
          steps: [
            {
              id: 'substep1',
              name: 'Sub Step',
              description: 'A nested step',
              actions: [
                {
                  id: 'sub-action',
                  type: 'sub_process',
                  description: 'Sub processing'
                }
              ]
            }
          ]
        }
      ],
      successCriteria: [
        {
          description: 'All steps complete successfully',
          condition: '${steps.all.success}'
        }
      ]
    };

    test('should handle complex plan with metadata', async () => {
      const result = await tool.execute({ plan: complexPlan });
      
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('## Plan Information');
      expect(result.markdown).toContain('**Plan ID**: complex-plan');
      expect(result.markdown).toContain('**Version**: 1.0.0');
      expect(result.markdown).toContain('**Created**: 2024-01-01T00:00:00Z');
      expect(result.markdown).toContain('**Complexity**: high');
    });

    test('should show required modules', async () => {
      const result = await tool.execute({ plan: complexPlan });
      
      expect(result.markdown).toContain('## Required Modules');
      expect(result.markdown).toContain('- `module1`');
      expect(result.markdown).toContain('- `module2`');
    });

    test('should handle nested steps', async () => {
      const result = await tool.execute({ plan: complexPlan });
      
      expect(result.markdown).toContain('### Setup Step');
      expect(result.markdown).toContain('### Main Step');
      expect(result.markdown).toContain('#### Sub Step');
    });

    test('should show dependencies', async () => {
      const result = await tool.execute({ plan: complexPlan });
      
      expect(result.markdown).toContain('**Dependencies**: step1');
    });

    test('should include success criteria', async () => {
      const result = await tool.execute({ plan: complexPlan });
      
      expect(result.markdown).toContain('## Success Criteria');
      expect(result.markdown).toContain('All steps complete successfully');
      expect(result.markdown).toContain('${steps.all.success}');
    });

    test('should include analysis when requested', async () => {
      const result = await tool.execute({ 
        plan: complexPlan, 
        includeAnalysis: true 
      });
      
      expect(result.markdown).toContain('## Dependencies');
      expect(result.markdown).toContain('## Complexity Analysis');
      expect(result.markdown).toContain('| Metric | Value |');
      expect(result.markdown).toContain('| Total Steps |');
      expect(result.markdown).toContain('| Total Actions |');
    });

    test('should generate mermaid diagram for dependencies', async () => {
      const result = await tool.execute({ 
        plan: complexPlan, 
        includeAnalysis: true 
      });
      
      expect(result.markdown).toContain('```mermaid');
      expect(result.markdown).toContain('graph TD');
      expect(result.markdown).toContain('step1 --> step2');
    });
  });

  describe('Document Statistics', () => {
    const simplePlan = {
      id: 'stats-test',
      name: 'Statistics Test',
      steps: [
        {
          id: 'step1',
          name: 'Test Step',
          actions: [{ id: 'action1', type: 'test' }]
        }
      ]
    };

    test('should calculate document statistics', async () => {
      const result = await tool.execute({ plan: simplePlan });
      
      expect(result.stats).toBeDefined();
      expect(result.stats.lines).toBeGreaterThan(0);
      expect(result.stats.words).toBeGreaterThan(0);
      expect(result.stats.characters).toBeGreaterThan(0);
      expect(result.stats.size).toContain('KB');
    });
  });

  describe('Error Handling', () => {
    test('should handle plan with no steps', async () => {
      const planWithoutSteps = {
        id: 'no-steps',
        name: 'Plan Without Steps'
      };
      
      const result = await tool.execute({ plan: planWithoutSteps });
      
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Plan Without Steps');
    });

    test('should handle execution errors gracefully', async () => {
      // Mock console.error to avoid test output pollution
      const originalError = console.error;
      console.error = jest.fn();
      
      // Create a plan that might cause issues during processing
      const problematicPlan = {
        id: 'problematic',
        name: null, // This might cause issues in string processing
        steps: []
      };
      
      const result = await tool.execute({ plan: problematicPlan });
      
      // Should still succeed even with problematic data
      expect(result.success).toBe(true);
      
      console.error = originalError;
    });
  });

  describe('Format Validation', () => {
    const simplePlan = {
      id: 'format-test',
      name: 'Format Test',
      steps: []
    };

    test('should handle valid format options', async () => {
      const formats = ['detailed', 'summary', 'execution-guide'];
      
      for (const format of formats) {
        const result = await tool.execute({ plan: simplePlan, format });
        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
      }
    });

    test('should default to detailed for invalid format', async () => {
      const result = await tool.execute({ 
        plan: simplePlan, 
        format: 'invalid-format' 
      });
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('detailed');
    });
  });

  describe('Utility Functions', () => {
    test('should count steps correctly', () => {
      const plan = {
        steps: [
          { id: 'step1' },
          { 
            id: 'step2', 
            steps: [
              { id: 'substep1' },
              { id: 'substep2' }
            ]
          }
        ]
      };
      
      const count = tool._countSteps(plan.steps);
      expect(count).toBe(4); // 2 main steps + 2 sub steps
    });

    test('should count actions correctly', () => {
      const plan = {
        steps: [
          { 
            id: 'step1',
            actions: [
              { id: 'action1' },
              { id: 'action2' }
            ]
          },
          { 
            id: 'step2',
            actions: [{ id: 'action3' }],
            steps: [
              {
                id: 'substep1',
                actions: [{ id: 'action4' }]
              }
            ]
          }
        ]
      };
      
      const count = tool._countActions(plan.steps);
      expect(count).toBe(4); // 2 + 1 + 1 actions
    });

    test('should calculate max depth correctly', () => {
      const plan = {
        steps: [
          { id: 'step1' },
          { 
            id: 'step2',
            steps: [
              { 
                id: 'substep1',
                steps: [
                  { id: 'subsubstep1' }
                ]
              }
            ]
          }
        ]
      };
      
      const depth = tool._calculateMaxDepth(plan.steps);
      expect(depth).toBe(3); // 3 levels deep
    });
  });
});