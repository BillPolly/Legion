/**
 * Unit tests for AgentCreator complex agent functionality
 */

import { jest } from '@jest/globals';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentCreator - Complex Agent Methods', () => {
  let agentCreator;
  let resourceManager;
  let mockInformalPlanner;
  let mockToolFeasibilityChecker;
  let mockToolRegistry;

  beforeEach(async () => {
    jest.setTimeout(30000);
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create AgentCreator
    agentCreator = new AgentCreator(resourceManager);
    
    // Mock the planning components for unit testing
    mockInformalPlanner = {
      plan: jest.fn().mockResolvedValue({
        hierarchy: {
          description: 'Test task',
          complexity: 'COMPLEX',
          subtasks: [
            { description: 'Subtask 1', complexity: 'SIMPLE' },
            { description: 'Subtask 2', complexity: 'SIMPLE' }
          ]
        },
        validation: {
          valid: true,
          structure: { valid: true },
          dependencies: { valid: true },
          completeness: { valid: true }
        },
        statistics: {
          totalNodes: 3,
          decomposedNodes: 1,
          totalTasks: 3,
          simpleTasks: 2,
          complexTasks: 1
        }
      })
    };
    
    mockToolFeasibilityChecker = {
      generateToolDescriptions: jest.fn().mockResolvedValue([
        'Tool for data processing',
        'Tool for file operations'
      ]),
      discoverToolsFromDescriptions: jest.fn().mockResolvedValue([
        { name: 'file_write', description: 'Write files', confidence: 0.9 },
        { name: 'json_parse', description: 'Parse JSON', confidence: 0.8 }
      ])
    };
    
    mockToolRegistry = {
      searchTools: jest.fn().mockResolvedValue([
        { name: 'tool1', score: 0.9 },
        { name: 'tool2', score: 0.8 }
      ]),
      getTool: jest.fn().mockResolvedValue({
        name: 'tool1',
        execute: async () => ({ success: true })
      })
    };
    
    // Replace components with mocks for unit testing
    agentCreator.informalPlanner = mockInformalPlanner;
    agentCreator.toolFeasibilityChecker = mockToolFeasibilityChecker;
    agentCreator.toolRegistry = mockToolRegistry;
  });

  afterEach(async () => {
    if (agentCreator) {
      await agentCreator.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('decomposeRequirements', () => {
    test('should decompose complex requirements using InformalPlanner', async () => {
      const requirements = {
        purpose: 'Create a data processing pipeline',
        taskType: 'analytical'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(mockInformalPlanner.plan).toHaveBeenCalledWith(
        requirements.purpose,
        expect.objectContaining({
          domain: undefined,
          capabilities: undefined,
          constraints: undefined
        })
      );
      
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.validation).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    test('should handle decomposition failures gracefully', async () => {
      mockInformalPlanner.plan.mockRejectedValueOnce(new Error('Planning failed'));

      const requirements = {
        purpose: 'Invalid task',
        taskType: 'task'
      };

      await expect(agentCreator.decomposeRequirements(requirements))
        .rejects.toThrow('Planning failed');
    });
  });

  describe('discoverToolsForHierarchy', () => {
    test('should discover tools for all SIMPLE tasks in hierarchy', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main task',
        subtasks: [
          { complexity: 'SIMPLE', description: 'Read file' },
          { complexity: 'SIMPLE', description: 'Process data' },
          {
            complexity: 'COMPLEX',
            description: 'Generate output',
            subtasks: [
              { complexity: 'SIMPLE', description: 'Format result' },
              { complexity: 'SIMPLE', description: 'Write file' }
            ]
          }
        ]
      };

      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);

      // Should call tool discovery for each SIMPLE task (4 total)
      expect(mockToolFeasibilityChecker.generateToolDescriptions).toHaveBeenCalledTimes(4);
      expect(mockToolFeasibilityChecker.discoverToolsFromDescriptions).toHaveBeenCalledTimes(4);
      
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBeGreaterThan(0);
      expect(tools.allTools).toContain('file_write');
      expect(tools.allTools).toContain('json_parse');
    });

    test('should handle empty hierarchy', async () => {
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Single task'
      };

      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);

      expect(mockToolFeasibilityChecker.generateToolDescriptions).toHaveBeenCalledTimes(1);
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBeGreaterThan(0);
    });

    test('should skip COMPLEX nodes without tools', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Complex task',
        subtasks: []
      };

      const tools = await agentCreator.discoverToolsForHierarchy(hierarchy);

      // Should not call tool discovery for COMPLEX nodes
      expect(mockToolFeasibilityChecker.generateToolDescriptions).not.toHaveBeenCalled();
      expect(tools.allTools).toBeDefined();
      expect(tools.allTools.length).toBe(0);
    });
  });

  describe('generateEnhancedSystemPrompt', () => {
    test('should generate prompt with hierarchy information', () => {
      const requirements = {
        purpose: 'Process data and generate reports',
        taskType: 'analytical'
      };

      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main task',
        subtasks: [
          { complexity: 'SIMPLE', description: 'Load data' },
          { complexity: 'SIMPLE', description: 'Analyze data' },
          { complexity: 'SIMPLE', description: 'Generate report' }
        ]
      };

      const tools = {
        allTools: ['file_read', 'data_analyze', 'report_generate'],
        toolsByTask: new Map()
      };

      const prompt = agentCreator.generateEnhancedSystemPrompt(requirements, hierarchy, tools);

      expect(prompt).toContain('analytical AI agent');
      expect(prompt).toContain('Process data and generate reports');
      expect(prompt).toContain('To accomplish this, you will:');
      expect(prompt).toContain('Load data');
      expect(prompt).toContain('Analyze data');
      expect(prompt).toContain('Generate report');
      expect(prompt).toContain('You have access to the following tools:');
      expect(prompt).toContain('file_read');
    });

    test('should handle simple tasks without subtasks', () => {
      const requirements = {
        purpose: 'Simple task',
        taskType: 'task'
      };

      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Simple task'
      };

      const tools = {
        allTools: ['tool1'],
        toolsByTask: new Map()
      };

      const prompt = agentCreator.generateEnhancedSystemPrompt(requirements, hierarchy, tools);

      expect(prompt).toContain('task AI agent');
      expect(prompt).not.toContain('To accomplish this, you will:');
      expect(prompt).toContain('You have access to the following tools:');
    });
  });

  describe('extractDataFlow', () => {
    test('should extract data flow from hierarchy with I/O', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Step 1',
            suggestedInputs: ['raw_data'],
            suggestedOutputs: ['processed_data']
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 2',
            suggestedInputs: ['processed_data'],
            suggestedOutputs: ['final_result']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow.size).toBe(2);
      expect(dataFlow.has('Step 1')).toBe(true);
      expect(dataFlow.get('Step 1')).toEqual({
        from: 'raw_data',
        to: 'processed_data'
      });
      expect(dataFlow.get('Step 2')).toEqual({
        from: 'processed_data',
        to: 'final_result'
      });
    });

    test('should handle nested hierarchy', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Phase 1',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Step 1.1',
                suggestedInputs: ['input'],
                suggestedOutputs: ['output1']
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 2',
            suggestedInputs: ['output1'],
            suggestedOutputs: ['output2']
          }
        ]
      };

      const dataFlow = agentCreator.extractDataFlow(hierarchy);

      expect(dataFlow.size).toBe(2);
      expect(dataFlow.has('Step 1.1')).toBe(true);
      expect(dataFlow.has('Step 2')).toBe(true);
    });
  });

  describe('generateBehaviorTree', () => {
    test('should generate behavior tree from complex hierarchy', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Task 1',
            tools: [{ name: 'tool1' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Task 2',
            tools: [{ name: 'tool2' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.id).toContain('sequence-');
      expect(behaviorTree.name).toBe('Main workflow');
      expect(behaviorTree.children).toHaveLength(2);
      expect(behaviorTree.children[0].type).toBe('agent_tool');
      expect(behaviorTree.children[0].tool).toBe('tool1');
      expect(behaviorTree.children[1].tool).toBe('tool2');
    });

    test('should handle nested complex tasks', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Phase 1',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Step 1.1',
                tools: [{ name: 'tool1' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Step 1.2',
                tools: [{ name: 'tool2' }]
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 2',
            tools: [{ name: 'tool3' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(2);
      
      // First child should be a sequence for Phase 1
      expect(behaviorTree.children[0].type).toBe('sequence');
      expect(behaviorTree.children[0].children).toHaveLength(2);
      
      // Second child should be an action for Step 2
      expect(behaviorTree.children[1].type).toBe('agent_tool');
      expect(behaviorTree.children[1].tool).toBe('tool3');
    });

    test('should handle simple tasks without tools', () => {
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Simple task'
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree.type).toBe('agent_tool');
      expect(behaviorTree.name).toBe('Simple task');
      expect(behaviorTree.tool).toBe('generic_action');
      expect(behaviorTree.params.description).toBe('Simple task');
    });
  });

  describe('designComplexAgent', () => {
    test('should create enhanced agent configuration', async () => {
      const requirements = {
        purpose: 'Complex data processing',
        taskType: 'analytical'
      };

      const decomposition = {
        hierarchy: {
          complexity: 'COMPLEX',
          description: 'Main',
          subtasks: [
            { 
              complexity: 'SIMPLE', 
              description: 'Step 1',
              suggestedInputs: ['input'],
              suggestedOutputs: ['output']
            },
            { complexity: 'SIMPLE', description: 'Step 2' }
          ]
        }
      };

      const tools = {
        allTools: ['tool1', 'tool2'],
        toolsByTask: new Map()
      };

      const config = await agentCreator.designComplexAgent(requirements, decomposition, tools);

      expect(config.agent).toBeDefined();
      expect(config.agent.name).toContain('Complex');
      expect(config.agent.type).toBe('analytical');
      expect(config.agent.prompts.system).toContain('To accomplish this');
      expect(config.taskHierarchy).toEqual(decomposition.hierarchy);
      expect(config.dataFlow).toBeDefined();
      expect(config.dataFlow).toBeInstanceOf(Map);
      expect(config.dataFlow.has('Step 1')).toBe(true);
      expect(config.capabilities).toBeDefined();
      expect(config.capabilities.tools).toBeDefined();
      expect(config.capabilities.tools.length).toBeGreaterThan(0);
    });

    test('should include behavior tree for complex tasks', async () => {
      const requirements = {
        purpose: 'Workflow orchestration',
        taskType: 'task'
      };

      const decomposition = {
        hierarchy: {
          complexity: 'COMPLEX',
          description: 'Workflow',
          subtasks: [
            { complexity: 'SIMPLE', description: 'Step 1', tools: [{ name: 'tool1' }] }
          ]
        }
      };

      const tools = {
        allTools: ['tool1'],
        toolsByTask: new Map()
      };

      const config = await agentCreator.designComplexAgent(requirements, decomposition, tools);

      expect(config.behaviorTree).toBeDefined();
      expect(config.behaviorTree.type).toBe('sequence');
    });
  });
});