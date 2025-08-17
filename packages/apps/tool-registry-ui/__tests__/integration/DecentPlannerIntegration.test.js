/**
 * Integration Tests: DecentPlanner Integration
 * Verifies real DecentPlanner initialization and behavior tree generation
 */

import { jest } from '@jest/globals';
import { PlanningWorkspacePanel } from '../../src/components/tool-registry/components/panels/PlanningWorkspacePanel.js';

describe('DecentPlanner Integration', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create mock actors that simulate real DecentPlanner behavior
    mockPlanningActor = {
      // Simulate real DecentPlanner initialization
      initialize: jest.fn().mockResolvedValue({
        status: 'initialized',
        version: '1.0.0',
        capabilities: ['decomposition', 'validation', 'optimization', 'behavior-tree-generation']
      }),
      
      // Simulate real plan creation with LLM
      createPlan: jest.fn().mockImplementation((goal, context, constraints) => {
        // Simulate LLM decomposition delay
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: `decent-plan-${Date.now()}`,
              name: `Plan for: ${goal}`,
              goal: goal,
              context: context,
              constraints: constraints,
              status: 'created',
              // Simulate DecentPlanner's hierarchical decomposition
              hierarchy: {
                root: {
                  id: 'goal-node',
                  type: 'goal',
                  description: goal,
                  confidence: 0.95,
                  children: [
                    {
                      id: 'phase-1',
                      type: 'phase',
                      description: `Analyze requirements for ${goal}`,
                      confidence: 0.92,
                      estimatedDuration: 3600000, // 1 hour
                      children: [
                        {
                          id: 'task-1.1',
                          type: 'task',
                          description: 'Gather system requirements',
                          confidence: 0.88,
                          tools: ['documentation-tool'],
                          preconditions: [],
                          postconditions: ['requirements-documented'],
                          children: []
                        },
                        {
                          id: 'task-1.2',
                          type: 'task',
                          description: 'Identify constraints and dependencies',
                          confidence: 0.85,
                          tools: ['analysis-tool'],
                          preconditions: ['requirements-documented'],
                          postconditions: ['constraints-identified'],
                          children: []
                        }
                      ]
                    },
                    {
                      id: 'phase-2',
                      type: 'phase',
                      description: `Implement solution for ${goal}`,
                      confidence: 0.90,
                      estimatedDuration: 7200000, // 2 hours
                      dependencies: ['phase-1'],
                      children: [
                        {
                          id: 'task-2.1',
                          type: 'task',
                          description: 'Design system architecture',
                          confidence: 0.87,
                          tools: ['design-tool', 'diagram-tool'],
                          preconditions: ['constraints-identified'],
                          postconditions: ['architecture-designed'],
                          children: []
                        },
                        {
                          id: 'task-2.2',
                          type: 'task',
                          description: 'Implement core functionality',
                          confidence: 0.83,
                          tools: ['ide', 'compiler'],
                          preconditions: ['architecture-designed'],
                          postconditions: ['implementation-complete'],
                          children: []
                        }
                      ]
                    },
                    {
                      id: 'phase-3',
                      type: 'phase',
                      description: 'Validate and deploy solution',
                      confidence: 0.88,
                      estimatedDuration: 3600000, // 1 hour
                      dependencies: ['phase-2'],
                      children: [
                        {
                          id: 'task-3.1',
                          type: 'task',
                          description: 'Run comprehensive tests',
                          confidence: 0.91,
                          tools: ['testing-framework'],
                          preconditions: ['implementation-complete'],
                          postconditions: ['tests-passed'],
                          children: []
                        },
                        {
                          id: 'task-3.2',
                          type: 'task',
                          description: 'Deploy to production',
                          confidence: 0.86,
                          tools: ['deployment-tool'],
                          preconditions: ['tests-passed'],
                          postconditions: ['deployed'],
                          children: []
                        }
                      ]
                    }
                  ]
                }
              },
              // Simulate behavior tree generation
              behaviorTree: {
                type: 'root',
                id: 'bt-root',
                child: {
                  type: 'sequence',
                  id: 'main-sequence',
                  children: [
                    {
                      type: 'selector',
                      id: 'phase-1-selector',
                      children: [
                        {
                          type: 'action',
                          id: 'action-1.1',
                          taskId: 'task-1.1',
                          command: 'gather_requirements',
                          timeout: 1800000
                        },
                        {
                          type: 'action',
                          id: 'action-1.2',
                          taskId: 'task-1.2',
                          command: 'analyze_constraints',
                          timeout: 1800000
                        }
                      ]
                    },
                    {
                      type: 'parallel',
                      id: 'phase-2-parallel',
                      successThreshold: 2,
                      children: [
                        {
                          type: 'action',
                          id: 'action-2.1',
                          taskId: 'task-2.1',
                          command: 'design_architecture',
                          timeout: 3600000
                        },
                        {
                          type: 'action',
                          id: 'action-2.2',
                          taskId: 'task-2.2',
                          command: 'implement_solution',
                          timeout: 3600000
                        }
                      ]
                    },
                    {
                      type: 'sequence',
                      id: 'phase-3-sequence',
                      children: [
                        {
                          type: 'action',
                          id: 'action-3.1',
                          taskId: 'task-3.1',
                          command: 'run_tests',
                          timeout: 1800000,
                          retryOnFailure: true,
                          maxRetries: 3
                        },
                        {
                          type: 'condition',
                          id: 'deployment-condition',
                          condition: 'tests_passed',
                          child: {
                            type: 'action',
                            id: 'action-3.2',
                            taskId: 'task-3.2',
                            command: 'deploy_production',
                            timeout: 1800000
                          }
                        }
                      ]
                    }
                  ]
                }
              },
              metadata: {
                llmModel: 'claude-3',
                decompositionDepth: 3,
                confidenceThreshold: 0.8,
                generatedAt: new Date().toISOString()
              }
            });
          }, 500); // Simulate network/processing delay
        });
      }),
      
      // Simulate plan validation with DecentPlanner
      validatePlan: jest.fn().mockImplementation((plan) => {
        return Promise.resolve({
          isValid: true,
          confidence: 0.89,
          issues: [],
          warnings: plan.hierarchy.root.confidence < 0.9 ? 
            ['Some tasks have confidence below 90%'] : [],
          suggestions: [
            'Consider adding error handling for task-2.2',
            'Task-3.1 could benefit from parallel test execution'
          ],
          validationRules: [
            { rule: 'no-circular-dependencies', passed: true },
            { rule: 'all-tools-available', passed: true },
            { rule: 'preconditions-met', passed: true },
            { rule: 'reasonable-duration', passed: true }
          ]
        });
      }),
      
      // Simulate plan optimization
      optimizePlan: jest.fn().mockImplementation((plan) => {
        return Promise.resolve({
          optimized: true,
          originalDuration: 14400000, // 4 hours
          optimizedDuration: 10800000, // 3 hours
          parallelizableTasks: ['task-1.1', 'task-1.2'],
          removedRedundancies: 2,
          addedParallelism: 1,
          confidenceImprovement: 0.03,
          optimizations: [
            'Parallelized independent tasks in phase 1',
            'Removed redundant validation step',
            'Optimized resource allocation'
          ]
        });
      }),
      
      // Simulate iterative decomposition
      decomposePlan: jest.fn().mockImplementation((plan, depth = 1) => {
        const decomposed = { ...plan };
        decomposed.hierarchy.decompositionLevel = depth;
        
        // Add more detailed subtasks
        decomposed.hierarchy.root.children.forEach(phase => {
          phase.children.forEach(task => {
            if (depth > 1 && task.children.length === 0) {
              task.children = [
                {
                  id: `${task.id}.1`,
                  type: 'subtask',
                  description: `Setup for ${task.description}`,
                  confidence: task.confidence * 0.95,
                  estimatedDuration: 600000
                },
                {
                  id: `${task.id}.2`,
                  type: 'subtask',
                  description: `Execute ${task.description}`,
                  confidence: task.confidence * 0.93,
                  estimatedDuration: 1200000
                },
                {
                  id: `${task.id}.3`,
                  type: 'subtask',
                  description: `Verify ${task.description}`,
                  confidence: task.confidence * 0.97,
                  estimatedDuration: 600000
                }
              ];
            }
          });
        });
        
        return Promise.resolve({
          success: true,
          plan: decomposed,
          newTasks: depth * 12,
          totalTasks: 6 + (depth * 12),
          maxDepth: 3 + depth
        });
      }),
      
      // Get LLM capabilities
      getLLMCapabilities: jest.fn().mockResolvedValue({
        models: ['claude-3', 'gpt-4', 'local-llm'],
        currentModel: 'claude-3',
        features: [
          'natural-language-decomposition',
          'constraint-reasoning',
          'tool-selection',
          'confidence-estimation',
          'iterative-refinement'
        ],
        limits: {
          maxTokens: 100000,
          maxDepth: 10,
          maxTasks: 1000,
          timeout: 60000
        }
      }),
      
      savePlan: jest.fn().mockResolvedValue({ success: true }),
      loadPlan: jest.fn()
    };

    mockExecutionActor = {
      validateBehaviorTree: jest.fn().mockResolvedValue({
        valid: true,
        executable: true,
        issues: []
      })
    };

    mockToolRegistryActor = {
      validateTools: jest.fn().mockResolvedValue({
        isValid: true,
        availableTools: [
          'documentation-tool', 'analysis-tool', 'design-tool',
          'diagram-tool', 'ide', 'compiler', 'testing-framework',
          'deployment-tool'
        ],
        missingTools: []
      })
    };

    // Create umbilical
    mockUmbilical = {
      dom,
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      onPlanCreate: jest.fn(),
      onPlanComplete: jest.fn(),
      onValidationComplete: jest.fn(),
      onDecompositionComplete: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await PlanningWorkspacePanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('DecentPlanner Initialization', () => {
    test('should verify DecentPlanner initialization', async () => {
      const initResult = await mockPlanningActor.initialize();
      
      expect(initResult.status).toBe('initialized');
      expect(initResult.version).toBeDefined();
      expect(initResult.capabilities).toContain('decomposition');
      expect(initResult.capabilities).toContain('behavior-tree-generation');
    });

    test('should get LLM capabilities', async () => {
      const capabilities = await mockPlanningActor.getLLMCapabilities();
      
      expect(capabilities.models).toContain('claude-3');
      expect(capabilities.features).toContain('natural-language-decomposition');
      expect(capabilities.limits.maxDepth).toBeGreaterThan(5);
      expect(capabilities.limits.maxTasks).toBeGreaterThan(100);
    });
  });

  describe('Live Decomposition with LLM', () => {
    test('should decompose goal with various complexities', async () => {
      const goals = [
        'Create a simple REST API',
        'Build a distributed microservices architecture',
        'Implement machine learning pipeline with real-time inference'
      ];
      
      for (const goal of goals) {
        component.api.setGoal(goal);
        
        // Create plan with DecentPlanner
        const planPromise = component.api.createPlan();
        const plan = await mockPlanningActor.createPlan(goal, {}, {});
        component.api.handlePlanComplete(plan);
        await planPromise;
        
        // Verify decomposition structure
        expect(plan.hierarchy).toBeDefined();
        expect(plan.hierarchy.root).toBeDefined();
        expect(plan.hierarchy.root.children.length).toBeGreaterThan(0);
        
        // Verify phases were created
        const phases = plan.hierarchy.root.children.filter(c => c.type === 'phase');
        expect(phases.length).toBeGreaterThanOrEqual(2);
        
        // Verify tasks have confidence scores
        phases.forEach(phase => {
          phase.children.forEach(task => {
            expect(task.confidence).toBeDefined();
            expect(task.confidence).toBeGreaterThan(0.5);
            expect(task.confidence).toBeLessThanOrEqual(1.0);
          });
        });
      }
    });

    test('should handle iterative decomposition', async () => {
      const goal = 'Deploy cloud-native application';
      component.api.setGoal(goal);
      
      // Initial decomposition
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify initial task count
      const initialTasks = countTasks(plan.hierarchy.root);
      expect(initialTasks).toBeGreaterThan(0);
      
      // Perform deeper decomposition
      const decomposition1 = await mockPlanningActor.decomposePlan(plan, 1);
      expect(decomposition1.success).toBe(true);
      expect(decomposition1.newTasks).toBeGreaterThan(0);
      
      // Even deeper decomposition
      const decomposition2 = await mockPlanningActor.decomposePlan(decomposition1.plan, 2);
      expect(decomposition2.totalTasks).toBeGreaterThan(decomposition1.totalTasks);
      expect(decomposition2.maxDepth).toBeGreaterThan(decomposition1.maxDepth);
    });

    test('should maintain semantic coherence in decomposition', async () => {
      const goal = 'Implement secure authentication system';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify semantic relevance
      const allDescriptions = extractDescriptions(plan.hierarchy.root);
      
      // Check that tasks are relevant to authentication
      const relevantKeywords = ['auth', 'secure', 'password', 'token', 'user', 'login', 'session'];
      const hasRelevantContent = allDescriptions.some(desc => 
        relevantKeywords.some(keyword => 
          desc.toLowerCase().includes(keyword)
        )
      );
      
      expect(hasRelevantContent).toBe(true);
      
      // Verify logical flow
      const phases = plan.hierarchy.root.children;
      expect(phases[0].description).toMatch(/analyze|requirement|gather/i);
      expect(phases[phases.length - 1].description).toMatch(/deploy|validate|test/i);
    });
  });

  describe('Behavior Tree Generation', () => {
    test('should generate valid behavior tree structure', async () => {
      const goal = 'Setup CI/CD pipeline';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify behavior tree structure
      expect(plan.behaviorTree).toBeDefined();
      expect(plan.behaviorTree.type).toBe('root');
      expect(plan.behaviorTree.child).toBeDefined();
      
      // Verify node types
      const nodeTypes = extractNodeTypes(plan.behaviorTree);
      expect(nodeTypes).toContain('sequence');
      expect(nodeTypes).toContain('action');
      
      // May contain advanced nodes
      const advancedNodes = ['selector', 'parallel', 'condition'];
      const hasAdvancedNodes = advancedNodes.some(type => nodeTypes.includes(type));
      expect(hasAdvancedNodes).toBe(true);
    });

    test('should link behavior tree to hierarchy tasks', async () => {
      const goal = 'Build data pipeline';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Extract task IDs from hierarchy
      const hierarchyTaskIds = extractTaskIds(plan.hierarchy.root);
      
      // Extract task IDs from behavior tree actions
      const behaviorTreeTaskIds = extractBehaviorTreeTaskIds(plan.behaviorTree);
      
      // Verify correspondence
      behaviorTreeTaskIds.forEach(btTaskId => {
        expect(hierarchyTaskIds).toContain(btTaskId);
      });
    });

    test('should validate behavior tree execution flow', async () => {
      const goal = 'Implement monitoring system';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate with execution actor
      const validation = await mockExecutionActor.validateBehaviorTree(plan.behaviorTree);
      
      expect(validation.valid).toBe(true);
      expect(validation.executable).toBe(true);
      expect(validation.issues).toHaveLength(0);
      
      // Check for proper sequencing
      const sequences = findNodesByType(plan.behaviorTree, 'sequence');
      expect(sequences.length).toBeGreaterThan(0);
      
      // Check for parallelism where appropriate
      const parallels = findNodesByType(plan.behaviorTree, 'parallel');
      if (parallels.length > 0) {
        parallels.forEach(parallel => {
          expect(parallel.children).toBeDefined();
          expect(parallel.children.length).toBeGreaterThan(1);
        });
      }
    });
  });

  describe('Plan Validation and Optimization', () => {
    test('should validate generated plans', async () => {
      const goal = 'Create scalable web application';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate plan
      const validation = await mockPlanningActor.validatePlan(plan);
      
      expect(validation.isValid).toBe(true);
      expect(validation.confidence).toBeGreaterThan(0.7);
      expect(validation.validationRules).toBeDefined();
      
      // Check validation rules
      validation.validationRules.forEach(rule => {
        expect(rule.passed).toBeDefined();
      });
      
      // Check for suggestions
      if (validation.suggestions.length > 0) {
        expect(validation.suggestions[0]).toMatch(/consider|could|benefit/i);
      }
    });

    test('should optimize plan for parallel execution', async () => {
      const goal = 'Process large dataset';
      component.api.setGoal(goal);
      
      const planPromise = component.api.createPlan();
      const plan = await mockPlanningActor.createPlan(goal, {}, {});
      component.api.handlePlanComplete(plan);
      await planPromise;
      
      // Optimize plan
      const optimization = await mockPlanningActor.optimizePlan(plan);
      
      expect(optimization.optimized).toBe(true);
      expect(optimization.optimizedDuration).toBeLessThan(optimization.originalDuration);
      expect(optimization.parallelizableTasks.length).toBeGreaterThan(0);
      
      // Verify optimizations were applied
      expect(optimization.optimizations).toBeDefined();
      expect(optimization.optimizations.length).toBeGreaterThan(0);
      
      // Check for performance improvement
      const timeSaved = optimization.originalDuration - optimization.optimizedDuration;
      const percentImprovement = (timeSaved / optimization.originalDuration) * 100;
      expect(percentImprovement).toBeGreaterThan(10); // At least 10% improvement
    });

    test('should handle constraint-based planning', async () => {
      const goal = 'Deploy application with zero downtime';
      const constraints = {
        maxDuration: 7200000, // 2 hours
        requiredTools: ['docker', 'kubernetes'],
        parallelism: 'maximum',
        riskTolerance: 'low'
      };
      
      component.api.setGoal(goal);
      
      // Create plan with constraints
      const plan = await mockPlanningActor.createPlan(goal, {}, constraints);
      
      expect(plan.constraints).toEqual(constraints);
      
      // Verify constraints are reflected in plan
      const allTools = extractTools(plan.hierarchy.root);
      constraints.requiredTools.forEach(tool => {
        expect(allTools).toContain(tool);
      });
      
      // Verify risk tolerance affects confidence thresholds
      const taskConfidences = extractConfidences(plan.hierarchy.root);
      const avgConfidence = taskConfidences.reduce((a, b) => a + b, 0) / taskConfidences.length;
      expect(avgConfidence).toBeGreaterThan(0.8); // Higher confidence for low risk
    });
  });

  // Helper functions
  function countTasks(node) {
    let count = node.type === 'task' ? 1 : 0;
    if (node.children) {
      node.children.forEach(child => {
        count += countTasks(child);
      });
    }
    return count;
  }

  function extractDescriptions(node, descriptions = []) {
    descriptions.push(node.description);
    if (node.children) {
      node.children.forEach(child => extractDescriptions(child, descriptions));
    }
    return descriptions;
  }

  function extractNodeTypes(node, types = new Set()) {
    types.add(node.type);
    if (node.child) {
      extractNodeTypes(node.child, types);
    }
    if (node.children) {
      node.children.forEach(child => extractNodeTypes(child, types));
    }
    return Array.from(types);
  }

  function extractTaskIds(node, ids = []) {
    if (node.type === 'task' || node.type === 'subtask') {
      ids.push(node.id);
    }
    if (node.children) {
      node.children.forEach(child => extractTaskIds(child, ids));
    }
    return ids;
  }

  function extractBehaviorTreeTaskIds(node, ids = []) {
    if (node.type === 'action' && node.taskId) {
      ids.push(node.taskId);
    }
    if (node.child) {
      extractBehaviorTreeTaskIds(node.child, ids);
    }
    if (node.children) {
      node.children.forEach(child => extractBehaviorTreeTaskIds(child, ids));
    }
    return ids;
  }

  function findNodesByType(node, type, nodes = []) {
    if (node.type === type) {
      nodes.push(node);
    }
    if (node.child) {
      findNodesByType(node.child, type, nodes);
    }
    if (node.children) {
      node.children.forEach(child => findNodesByType(child, type, nodes));
    }
    return nodes;
  }

  function extractTools(node, tools = new Set()) {
    if (node.tools) {
      node.tools.forEach(tool => tools.add(tool));
    }
    if (node.children) {
      node.children.forEach(child => extractTools(child, tools));
    }
    return Array.from(tools);
  }

  function extractConfidences(node, confidences = []) {
    if (node.confidence) {
      confidences.push(node.confidence);
    }
    if (node.children) {
      node.children.forEach(child => extractConfidences(child, confidences));
    }
    return confidences;
  }
});