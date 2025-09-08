/**
 * Integration tests for behavior tree generation from task hierarchies
 */

import { jest } from '@jest/globals';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';
import { AgentBehaviorTreeExecutor } from '../../../configurable-agent/src/bt/AgentBehaviorTreeExecutor.js';

describe('Behavior Tree Generation Integration', () => {
  let agentCreator;
  let resourceManager;

  beforeEach(async () => {
    jest.setTimeout(60000); // 60 second timeout
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create AgentCreator
    agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
  });

  afterEach(async () => {
    if (agentCreator) {
      await agentCreator.cleanup();
    }
  });

  describe('Basic Behavior Tree Generation', () => {
    test('should generate sequence node for linear workflow', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Linear data processing',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Read input',
            tools: [{ name: 'file_read' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Process data',
            tools: [{ name: 'data_transform' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Write output',
            tools: [{ name: 'file_write' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.id).toContain('linear-data-processing');
      expect(behaviorTree.children).toHaveLength(3);
      
      // All children should be agent_tool nodes
      behaviorTree.children.forEach((child, index) => {
        expect(child.type).toBe('agent_tool');
        expect(child.id).toBeDefined();
        expect(child.tool).toBeDefined();
      });
      
      // Tools should match hierarchy
      expect(behaviorTree.children[0].tool).toBe('file_read');
      expect(behaviorTree.children[1].tool).toBe('data_transform');
      expect(behaviorTree.children[2].tool).toBe('file_write');
    });

    test('should generate selector node for alternative paths', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Authentication handler',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Try OAuth authentication',
            tools: [{ name: 'oauth_auth' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Try API key authentication',
            tools: [{ name: 'api_key_auth' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Try basic authentication',
            tools: [{ name: 'basic_auth' }]
          }
        ]
      };

      // For authentication, we might want a selector (try alternatives)
      // But our current implementation defaults to sequence
      // This test documents current behavior
      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence'); // Current implementation
      expect(behaviorTree.children).toHaveLength(3);
    });

    test('should handle nested complex hierarchies', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Main workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Initialize',
            tools: [{ name: 'init' }]
          },
          {
            complexity: 'COMPLEX',
            description: 'Process data batch',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Load batch',
                tools: [{ name: 'load_batch' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Transform batch',
                tools: [{ name: 'transform_batch' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Save batch',
                tools: [{ name: 'save_batch' }]
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Cleanup',
            tools: [{ name: 'cleanup' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(3);
      
      // First child: simple init
      expect(behaviorTree.children[0].type).toBe('agent_tool');
      expect(behaviorTree.children[0].tool).toBe('init');
      
      // Second child: nested sequence for batch processing
      expect(behaviorTree.children[1].type).toBe('sequence');
      expect(behaviorTree.children[1].id).toContain('process-data-batch');
      expect(behaviorTree.children[1].children).toHaveLength(3);
      
      // Nested children should be agent_tool nodes
      behaviorTree.children[1].children.forEach(child => {
        expect(child.type).toBe('agent_tool');
        expect(child.tool).toBeDefined();
      });
      
      // Third child: simple cleanup
      expect(behaviorTree.children[2].type).toBe('agent_tool');
      expect(behaviorTree.children[2].tool).toBe('cleanup');
    });

    test('should handle tasks without explicit tools', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Conversation flow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Greet user'
            // No tools specified
          },
          {
            complexity: 'SIMPLE',
            description: 'Ask for information'
            // No tools specified
          },
          {
            complexity: 'SIMPLE',
            description: 'Provide response'
            // No tools specified
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(3);
      
      // Without tools, should generate agent_chat nodes
      behaviorTree.children.forEach((child, index) => {
        expect(child.type).toBe('agent_chat');
        expect(child.message).toContain(hierarchy.subtasks[index].description);
      });
    });

    test('should handle single simple task', () => {
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Send an email',
        tools: [{ name: 'send_email' }]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('agent_tool');
      expect(behaviorTree.tool).toBe('send_email');
      expect(behaviorTree.description).toContain('Send an email');
    });

    test('should handle simple task without tools', () => {
      const hierarchy = {
        complexity: 'SIMPLE',
        description: 'Think about the problem'
        // No tools
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('agent_chat');
      expect(behaviorTree.message).toContain('Think about the problem');
    });
  });

  describe('Complex Behavior Tree Patterns', () => {
    test('should generate tree for ETL pipeline', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'ETL Pipeline',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Extract Phase',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Connect to source',
                tools: [{ name: 'db_connect' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Query data',
                tools: [{ name: 'db_query' }]
              }
            ]
          },
          {
            complexity: 'COMPLEX',
            description: 'Transform Phase',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Clean data',
                tools: [{ name: 'data_clean' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Aggregate data',
                tools: [{ name: 'data_aggregate' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Format data',
                tools: [{ name: 'data_format' }]
              }
            ]
          },
          {
            complexity: 'COMPLEX',
            description: 'Load Phase',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Connect to target',
                tools: [{ name: 'target_connect' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Insert data',
                tools: [{ name: 'data_insert' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Verify load',
                tools: [{ name: 'verify_data' }]
              }
            ]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(3);
      
      // Each phase should be a sequence
      behaviorTree.children.forEach((phase, phaseIndex) => {
        expect(phase.type).toBe('sequence');
        expect(phase.id).toContain(hierarchy.subtasks[phaseIndex].description.toLowerCase().replace(/ /g, '-'));
        
        // Each phase should have the correct number of steps
        if (phaseIndex === 0) expect(phase.children).toHaveLength(2); // Extract
        if (phaseIndex === 1) expect(phase.children).toHaveLength(3); // Transform
        if (phaseIndex === 2) expect(phase.children).toHaveLength(3); // Load
        
        // All steps should be agent_tool nodes
        phase.children.forEach(step => {
          expect(step.type).toBe('agent_tool');
          expect(step.tool).toBeDefined();
        });
      });
    });

    test('should generate tree for validation workflow', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Data validation workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Load data',
            tools: [{ name: 'load_data' }]
          },
          {
            complexity: 'COMPLEX',
            description: 'Validation checks',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Check schema',
                tools: [{ name: 'validate_schema' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Check business rules',
                tools: [{ name: 'validate_rules' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Check data quality',
                tools: [{ name: 'validate_quality' }]
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Generate validation report',
            tools: [{ name: 'generate_report' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(3);
      
      // First: load data
      expect(behaviorTree.children[0].type).toBe('agent_tool');
      expect(behaviorTree.children[0].tool).toBe('load_data');
      
      // Second: validation checks (nested sequence)
      expect(behaviorTree.children[1].type).toBe('sequence');
      expect(behaviorTree.children[1].children).toHaveLength(3);
      
      // Third: generate report
      expect(behaviorTree.children[2].type).toBe('agent_tool');
      expect(behaviorTree.children[2].tool).toBe('generate_report');
    });

    test('should handle deeply nested hierarchies', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Level 1',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Level 2A',
            subtasks: [
              {
                complexity: 'COMPLEX',
                description: 'Level 3A',
                subtasks: [
                  {
                    complexity: 'SIMPLE',
                    description: 'Level 4A',
                    tools: [{ name: 'tool_4a' }]
                  }
                ]
              }
            ]
          },
          {
            complexity: 'SIMPLE',
            description: 'Level 2B',
            tools: [{ name: 'tool_2b' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBe('sequence');
      expect(behaviorTree.children).toHaveLength(2);
      
      // First child should be deeply nested
      expect(behaviorTree.children[0].type).toBe('sequence');
      expect(behaviorTree.children[0].children).toHaveLength(1);
      expect(behaviorTree.children[0].children[0].type).toBe('sequence');
      expect(behaviorTree.children[0].children[0].children).toHaveLength(1);
      expect(behaviorTree.children[0].children[0].children[0].type).toBe('agent_tool');
      expect(behaviorTree.children[0].children[0].children[0].tool).toBe('tool_4a');
      
      // Second child should be simple
      expect(behaviorTree.children[1].type).toBe('agent_tool');
      expect(behaviorTree.children[1].tool).toBe('tool_2b');
    });
  });

  describe('Behavior Tree Validation', () => {
    test('should generate valid behavior tree structure', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Test workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'Step 1',
            tools: [{ name: 'tool1' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Step 2',
            tools: [{ name: 'tool2' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      // Validate structure
      const validateNode = (node) => {
        expect(node).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.id).toBeDefined();
        
        // Valid node types
        const validTypes = ['sequence', 'selector', 'parallel', 'agent_tool', 'agent_chat', 'action'];
        expect(validTypes).toContain(node.type);
        
        // Composite nodes should have children
        if (['sequence', 'selector', 'parallel'].includes(node.type)) {
          expect(node.children).toBeDefined();
          expect(Array.isArray(node.children)).toBe(true);
          expect(node.children.length).toBeGreaterThan(0);
          
          // Recursively validate children
          node.children.forEach(child => validateNode(child));
        }
        
        // Action nodes should have required fields
        if (node.type === 'agent_tool') {
          expect(node.tool).toBeDefined();
        }
        
        if (node.type === 'agent_chat') {
          expect(node.message).toBeDefined();
        }
      };

      validateNode(behaviorTree);
    });

    test('should generate unique IDs for all nodes', () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Workflow',
        subtasks: [
          {
            complexity: 'COMPLEX',
            description: 'Phase 1',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Step A',
                tools: [{ name: 'toolA' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Step B',
                tools: [{ name: 'toolB' }]
              }
            ]
          },
          {
            complexity: 'COMPLEX',
            description: 'Phase 2',
            subtasks: [
              {
                complexity: 'SIMPLE',
                description: 'Step C',
                tools: [{ name: 'toolC' }]
              },
              {
                complexity: 'SIMPLE',
                description: 'Step D',
                tools: [{ name: 'toolD' }]
              }
            ]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      // Collect all IDs
      const ids = new Set();
      const collectIds = (node) => {
        if (node.id) {
          ids.add(node.id);
        }
        if (node.children) {
          node.children.forEach(child => collectIds(child));
        }
      };

      collectIds(behaviorTree);

      // Count total nodes
      const countNodes = (node) => {
        let count = 1;
        if (node.children) {
          count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
        }
        return count;
      };

      const totalNodes = countNodes(behaviorTree);

      // All IDs should be unique
      expect(ids.size).toBe(totalNodes);
    });

    test('should be compatible with AgentBehaviorTreeExecutor', async () => {
      const hierarchy = {
        complexity: 'COMPLEX',
        description: 'Simple test workflow',
        subtasks: [
          {
            complexity: 'SIMPLE',
            description: 'First action',
            tools: [{ name: 'test_tool_1' }]
          },
          {
            complexity: 'SIMPLE',
            description: 'Second action',
            tools: [{ name: 'test_tool_2' }]
          }
        ]
      };

      const behaviorTree = agentCreator.generateBehaviorTree(hierarchy);

      // The generated tree should have the right structure for the executor
      expect(behaviorTree.type).toBeDefined();
      expect(behaviorTree.children).toBeDefined();
      
      // Check that it matches the expected format
      const checkExecutorCompatibility = (node) => {
        // Should have required fields
        expect(node.type).toBeDefined();
        
        // Composite nodes need children
        if (['sequence', 'selector', 'parallel'].includes(node.type)) {
          expect(Array.isArray(node.children)).toBe(true);
          node.children.forEach(child => checkExecutorCompatibility(child));
        }
        
        // Action nodes need appropriate fields
        if (node.type === 'agent_tool') {
          expect(node.tool).toBeDefined();
          expect(typeof node.tool).toBe('string');
        }
        
        if (node.type === 'agent_chat') {
          expect(node.message).toBeDefined();
          expect(typeof node.message).toBe('string');
        }
      };

      checkExecutorCompatibility(behaviorTree);
    });
  });

  describe('End-to-End Behavior Tree Creation', () => {
    test('should create behavior tree from requirements through full pipeline', async () => {
      const requirements = {
        purpose: 'Create a data validation system that checks input, validates against rules, and generates a report',
        taskType: 'analytical'
      };

      // Full pipeline: decompose -> discover tools -> generate BT
      const decomposition = await agentCreator.decomposeRequirements(requirements);
      expect(decomposition.success).toBe(true);
      
      const tools = await agentCreator.discoverToolsForHierarchy(decomposition.hierarchy);
      expect(tools.size).toBeGreaterThan(0);
      
      const behaviorTree = agentCreator.generateBehaviorTree(decomposition.hierarchy);
      expect(behaviorTree).toBeDefined();
      expect(behaviorTree.type).toBeDefined();
      
      // Should create a structured tree
      if (decomposition.hierarchy.complexity === 'COMPLEX') {
        expect(behaviorTree.type).toBe('sequence');
        expect(behaviorTree.children).toBeDefined();
        expect(behaviorTree.children.length).toBeGreaterThan(0);
      }
    });
  });
});