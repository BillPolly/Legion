import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../src/core/ToolRegistry.js';

describe('ToolRegistry', () => {
  let toolRegistry;
  let mockModuleLoader;

  beforeEach(() => {
    // Create mock module loader
    mockModuleLoader = {
      getModules: jest.fn(),
      getModule: jest.fn(),
      hasModule: jest.fn(),
      createModuleInstance: jest.fn(),
      getAllModuleInstances: jest.fn()
    };
    
    // Set up mock modules
    const mockModules = new Map([
      ['calculator', {
        name: 'calculator',
        tools: {
          evaluate: {
            name: 'evaluate',
            description: 'Evaluate expression',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Expression to evaluate' }
              },
              required: ['expression']
            }
          },
          add: {
            name: 'add',
            description: 'Add two numbers',
            parameters: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              },
              required: ['a', 'b']
            }
          }
        }
      }],
      ['file', {
        name: 'file',
        tools: {
          read: {
            name: 'read',
            description: 'Read file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' }
              },
              required: ['path']
            }
          }
        }
      }]
    ]);
    
    mockModuleLoader.getModules.mockReturnValue(mockModules);
    mockModuleLoader.getModule.mockImplementation(name => mockModules.get(name));
    mockModuleLoader.hasModule.mockImplementation(name => mockModules.has(name));
    
    // Mock module instances for discoverTools
    const mockModuleInstances = [
      {
        name: 'calculator',
        getTools: () => [
          {
            getAllToolDescriptions: () => [
              {
                function: {
                  name: 'evaluate',
                  description: 'Evaluate expression',
                  parameters: {
                    type: 'object',
                    properties: {
                      expression: { type: 'string', description: 'Expression to evaluate' }
                    },
                    required: ['expression']
                  }
                }
              },
              {
                function: {
                  name: 'add',
                  description: 'Add two numbers',
                  parameters: {
                    type: 'object',
                    properties: {
                      a: { type: 'number' },
                      b: { type: 'number' }
                    },
                    required: ['a', 'b']
                  }
                }
              }
            ]
          }
        ]
      },
      {
        name: 'file',
        getTools: () => [
          {
            getToolDescription: () => ({
              function: {
                name: 'read',
                description: 'Read file',
                parameters: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' }
                  },
                  required: ['path']
                }
              }
            })
          }
        ]
      }
    ];
    
    mockModuleLoader.getAllModuleInstances.mockReturnValue(mockModuleInstances);
    
    toolRegistry = new ToolRegistry(mockModuleLoader);
  });

  describe('discoverTools', () => {
    it('should discover all tools from all modules', () => {
      const tools = toolRegistry.discoverTools();
      
      expect(tools.size).toBe(3);
      expect(tools.has('calculator.evaluate')).toBe(true);
      expect(tools.has('calculator.add')).toBe(true);
      expect(tools.has('file.read')).toBe(true);
    });

    it('should include module information in discovered tools', () => {
      const tools = toolRegistry.discoverTools();
      const evaluateTool = tools.get('calculator.evaluate');
      
      expect(evaluateTool.module).toBe('calculator');
      expect(evaluateTool.name).toBe('evaluate');
      expect(evaluateTool.description).toBe('Evaluate expression');
    });

    it('should cache discovered tools', () => {
      const tools1 = toolRegistry.discoverTools();
      const tools2 = toolRegistry.discoverTools();
      
      expect(tools1).toBe(tools2);
    });
  });

  describe('getToolByName', () => {
    it('should get tool by full name', () => {
      const tool = toolRegistry.getToolByName('calculator.evaluate');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('evaluate');
      expect(tool.module).toBe('calculator');
    });

    it('should return null for unknown tool', () => {
      const tool = toolRegistry.getToolByName('unknown.tool');
      
      expect(tool).toBeNull();
    });
  });

  describe('validateToolName', () => {
    it('should return true for existing tool', () => {
      expect(toolRegistry.validateToolName('calculator.evaluate')).toBe(true);
    });

    it('should return false for non-existing tool', () => {
      expect(toolRegistry.validateToolName('unknown.tool')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(toolRegistry.validateToolName('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(toolRegistry.validateToolName('')).toBe(false);
    });
  });

  describe('getToolsByModule', () => {
    it('should get all tools for a module', () => {
      const tools = toolRegistry.getToolsByModule('calculator');
      
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('evaluate');
      expect(tools[1].name).toBe('add');
    });

    it('should return empty array for unknown module', () => {
      const tools = toolRegistry.getToolsByModule('unknown');
      
      expect(tools).toEqual([]);
    });
  });

  describe('getAllToolNames', () => {
    it('should return all tool names sorted', () => {
      const toolNames = toolRegistry.getAllToolNames();
      
      expect(toolNames).toHaveLength(3);
      expect(toolNames).toContain('calculator.add');
      expect(toolNames).toContain('calculator.evaluate');
      expect(toolNames).toContain('file.read');
      // Check they are sorted
      expect(toolNames[0]).toBe('calculator.add');
      expect(toolNames[1]).toBe('calculator.evaluate');
      expect(toolNames[2]).toBe('file.read');
    });
  });

  describe('getToolMetadata', () => {
    it('should return tool metadata with examples', () => {
      const metadata = toolRegistry.getToolMetadata('calculator.evaluate');
      
      expect(metadata).toBeTruthy();
      expect(metadata.name).toBe('evaluate');
      expect(metadata.module).toBe('calculator');
      expect(metadata.description).toBe('Evaluate expression');
      expect(metadata.required).toEqual(['expression']);
      expect(metadata.examples).toHaveLength(2);
      expect(metadata.examples[0]).toContain('jsenvoy calculator.evaluate');
    });

    it('should return null for unknown tool', () => {
      const metadata = toolRegistry.getToolMetadata('unknown.tool');
      
      expect(metadata).toBeNull();
    });
  });

  describe('validateToolArguments', () => {
    it('should validate required parameters', () => {
      const result = toolRegistry.validateToolArguments('calculator.evaluate', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('expression');
    });

    it('should pass validation with all required parameters', () => {
      const result = toolRegistry.validateToolArguments('calculator.evaluate', {
        expression: '2 + 2'
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate parameter types', () => {
      const result = toolRegistry.validateToolArguments('calculator.add', {
        a: 'not a number',
        b: 2
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be of type number');
    });

    it('should return error for unknown tool', () => {
      const result = toolRegistry.validateToolArguments('unknown.tool', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Tool not found');
    });
  });

  describe('executeTool', () => {
    it('should execute tool with valid parameters', async () => {
      const mockToolInstance = {
        execute: jest.fn().mockResolvedValue({ result: 4 })
      };
      
      // Update mock to include tool instance
      const tools = toolRegistry.discoverTools();
      tools.get('calculator.evaluate').instance = mockToolInstance;
      
      const result = await toolRegistry.executeTool('calculator.evaluate', {
        expression: '2 + 2'
      });
      
      expect(mockToolInstance.execute).toHaveBeenCalledWith(
        { expression: '2 + 2' },
        'evaluate'
      );
      expect(result).toEqual({ result: 4 });
    });

    it('should throw error for unknown tool', async () => {
      await expect(
        toolRegistry.executeTool('unknown.tool', {})
      ).rejects.toThrow('Tool not found: unknown.tool');
    });

    it('should handle timeout', async () => {
      const mockToolInstance = {
        execute: jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      };
      
      const tools = toolRegistry.discoverTools();
      tools.get('calculator.evaluate').instance = mockToolInstance;
      
      await expect(
        toolRegistry.executeTool('calculator.evaluate', { expression: '2+2' }, { toolTimeout: 100 })
      ).rejects.toThrow('Tool execution timeout');
    });
  });

  describe('invalidateCache', () => {
    it('should clear the tool registry cache', () => {
      // First call to populate cache
      const tools1 = toolRegistry.discoverTools();
      expect(tools1.size).toBe(3);
      
      // Invalidate cache
      toolRegistry.invalidateCache();
      
      // Should rediscover tools
      const tools2 = toolRegistry.discoverTools();
      expect(tools2.size).toBe(3);
    });
  });
});