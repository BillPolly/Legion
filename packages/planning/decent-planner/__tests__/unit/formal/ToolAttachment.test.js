/**
 * Test for tool attachment in behavior trees
 * Verifies that LLM-generated tool names are replaced with actual tool objects
 */

import { GenerateBehaviorTreeUseCase } from '../../../src/application/use-cases/GenerateBehaviorTreeUseCase.js';
import { jest } from '@jest/globals';

describe('Tool Attachment in Behavior Trees', () => {
  let generateBTUseCase;
  let mockTask;
  let mockTools;
  let mockLogger;

  beforeEach(() => {
    // Create mock tools with execute methods
    mockTools = [
      {
        name: 'generate_javascript',
        execute: jest.fn().mockResolvedValue({ success: true, data: { code: 'console.log("hello");' } }),
        description: 'Generate JavaScript code'
      },
      {
        name: 'Write',
        execute: jest.fn().mockResolvedValue({ success: true }),
        description: 'Write files'
      }
    ];

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn()
    };

    // Create mock task with tools
    mockTask = {
      id: { toString: () => 'task-123' },
      description: 'write hello world',
      tools: mockTools,
      getToolCount: () => mockTools.length
    };

    generateBTUseCase = new GenerateBehaviorTreeUseCase({
      behaviorTreePlanner: {
        makePlan: jest.fn().mockResolvedValue({
          success: true,
          data: {
            plan: {
              type: 'sequence',
              id: 'root',
              description: 'Test behavior tree',
              children: [
                {
                  type: 'action',
                  id: 'generate-code',
                  tool: 'generate_javascript',
                  description: 'Generate code'
                },
                {
                  type: 'action',
                  id: 'write-file',
                  tool: 'Write', 
                  description: 'Write file'
                }
              ]
            }
          }
        })
      },
      logger: mockLogger
    });
  });

  test('should replace tool names with actual tool objects in behavior tree', async () => {
    // Execute generateForTask which should attach tool objects
    const result = await generateBTUseCase.generateForTask(mockTask);

    // Verify tool names were replaced with objects
    expect(typeof result.children[0].tool).toBe('object');
    expect(typeof result.children[1].tool).toBe('object');
    
    expect(result.children[0].tool).toBe(mockTools[0]); // generate_javascript
    expect(result.children[1].tool).toBe(mockTools[1]); // Write
    
    // Verify tools have execute methods
    expect(result.children[0].tool.execute).toBeDefined();
    expect(result.children[1].tool.execute).toBeDefined();
    
    // Verify tool names match
    expect(result.children[0].tool.name).toBe('generate_javascript');
    expect(result.children[1].tool.name).toBe('Write');
  });

  test('attachToolObjectsToBehaviorTree method works correctly', () => {
    const behaviorTree = {
      type: 'sequence',
      id: 'root',
      children: [
        {
          type: 'action',
          id: 'test-action',
          tool: 'generate_javascript',
          description: 'Test action'
        }
      ]
    };

    generateBTUseCase.attachToolObjectsToBehaviorTree(behaviorTree, mockTools);

    // Verify tool string was replaced with object
    expect(typeof behaviorTree.children[0].tool).toBe('object');
    expect(behaviorTree.children[0].tool.name).toBe('generate_javascript');
    expect(behaviorTree.children[0].tool.execute).toBeDefined();
  });

  test('should handle missing tools gracefully', () => {
    const behaviorTree = {
      type: 'sequence',
      id: 'root',
      children: [
        {
          type: 'action',
          id: 'missing-tool-node', 
          tool: 'nonexistent_tool',
          description: 'Uses missing tool'
        }
      ]
    };

    // Only provide generate_javascript, not the nonexistent_tool
    generateBTUseCase.attachToolObjectsToBehaviorTree(behaviorTree, [mockTools[0]]);

    // Tool should remain as string (not replaced)
    expect(typeof behaviorTree.children[0].tool).toBe('string');
    expect(behaviorTree.children[0].tool).toBe('nonexistent_tool');
    
    // Should have logged an error
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Tool object not found for action node',
      expect.objectContaining({
        nodeId: 'missing-tool-node',
        toolName: 'nonexistent_tool'
      })
    );
  });
});