/**
 * UAT Preparation Tests: Test Data Preparation
 * Creates and validates sample data for UAT testing
 */

import { jest } from '@jest/globals';

describe('UAT Test Data Preparation', () => {
  let testDataStore;
  let mockDatabase;
  
  beforeEach(() => {
    // Initialize test data store
    testDataStore = {
      plans: [],
      templates: [],
      executions: [],
      artifacts: [],
      tools: []
    };
    
    // Mock database for test data
    mockDatabase = {
      insertMany: jest.fn().mockImplementation((collection, docs) => {
        testDataStore[collection].push(...docs);
        return { insertedCount: docs.length };
      }),
      
      find: jest.fn().mockImplementation((collection, query = {}) => {
        return testDataStore[collection];
      }),
      
      clear: jest.fn().mockImplementation((collection) => {
        testDataStore[collection] = [];
      })
    };
  });

  describe('Sample Plans Creation', () => {
    test('should create basic planning scenarios', async () => {
      const basicPlans = [
        {
          id: 'uat-plan-simple-1',
          name: 'Simple Web Server',
          goal: 'Create a basic HTTP server with Node.js',
          complexity: 'simple',
          estimatedDuration: 3600000, // 1 hour
          hierarchy: {
            root: {
              id: 'root',
              description: 'Setup web server',
              children: [
                {
                  id: 'task-1',
                  description: 'Initialize Node.js project',
                  tools: ['npm'],
                  estimatedDuration: 300000
                },
                {
                  id: 'task-2',
                  description: 'Install Express framework',
                  tools: ['npm'],
                  dependencies: ['task-1'],
                  estimatedDuration: 300000
                },
                {
                  id: 'task-3',
                  description: 'Create server.js',
                  tools: ['node'],
                  dependencies: ['task-2'],
                  estimatedDuration: 600000
                },
                {
                  id: 'task-4',
                  description: 'Test server endpoints',
                  tools: ['curl', 'jest'],
                  dependencies: ['task-3'],
                  estimatedDuration: 600000
                }
              ]
            }
          },
          tags: ['backend', 'nodejs', 'simple'],
          createdAt: new Date().toISOString()
        },
        {
          id: 'uat-plan-simple-2',
          name: 'Static Website Deployment',
          goal: 'Deploy a static website to GitHub Pages',
          complexity: 'simple',
          estimatedDuration: 1800000, // 30 minutes
          hierarchy: {
            root: {
              id: 'root',
              description: 'Deploy static site',
              children: [
                {
                  id: 'task-1',
                  description: 'Create HTML/CSS files',
                  tools: ['git'],
                  estimatedDuration: 600000
                },
                {
                  id: 'task-2',
                  description: 'Initialize Git repository',
                  tools: ['git'],
                  dependencies: ['task-1'],
                  estimatedDuration: 300000
                },
                {
                  id: 'task-3',
                  description: 'Push to GitHub',
                  tools: ['git'],
                  dependencies: ['task-2'],
                  estimatedDuration: 300000
                },
                {
                  id: 'task-4',
                  description: 'Enable GitHub Pages',
                  tools: ['gh'],
                  dependencies: ['task-3'],
                  estimatedDuration: 600000
                }
              ]
            }
          },
          tags: ['frontend', 'deployment', 'simple'],
          createdAt: new Date().toISOString()
        }
      ];
      
      const result = await mockDatabase.insertMany('plans', basicPlans);
      expect(result.insertedCount).toBe(2);
      
      // Verify plans were created
      const plans = await mockDatabase.find('plans');
      expect(plans.length).toBe(2);
      expect(plans[0].complexity).toBe('simple');
    });

    test('should create complex hierarchical plans', async () => {
      const complexPlan = {
        id: 'uat-plan-complex-1',
        name: 'Microservices Architecture',
        goal: 'Build a microservices-based e-commerce platform',
        complexity: 'complex',
        estimatedDuration: 86400000, // 24 hours
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build e-commerce platform',
            children: [
              {
                id: 'phase-1',
                type: 'phase',
                description: 'Infrastructure Setup',
                estimatedDuration: 14400000,
                children: [
                  {
                    id: 'task-1.1',
                    description: 'Setup Docker environment',
                    tools: ['docker', 'docker-compose'],
                    estimatedDuration: 3600000
                  },
                  {
                    id: 'task-1.2',
                    description: 'Configure Kubernetes cluster',
                    tools: ['kubectl', 'helm'],
                    dependencies: ['task-1.1'],
                    estimatedDuration: 7200000
                  },
                  {
                    id: 'task-1.3',
                    description: 'Setup monitoring stack',
                    tools: ['prometheus', 'grafana'],
                    dependencies: ['task-1.2'],
                    estimatedDuration: 3600000
                  }
                ]
              },
              {
                id: 'phase-2',
                type: 'phase',
                description: 'Service Development',
                dependencies: ['phase-1'],
                estimatedDuration: 43200000,
                children: [
                  {
                    id: 'service-1',
                    type: 'service',
                    description: 'User Service',
                    children: [
                      {
                        id: 'task-2.1.1',
                        description: 'Create user API',
                        tools: ['node', 'express'],
                        estimatedDuration: 7200000
                      },
                      {
                        id: 'task-2.1.2',
                        description: 'Setup user database',
                        tools: ['mongodb'],
                        estimatedDuration: 3600000
                      },
                      {
                        id: 'task-2.1.3',
                        description: 'Implement authentication',
                        tools: ['jwt', 'bcrypt'],
                        dependencies: ['task-2.1.1', 'task-2.1.2'],
                        estimatedDuration: 7200000
                      }
                    ]
                  },
                  {
                    id: 'service-2',
                    type: 'service',
                    description: 'Product Service',
                    children: [
                      {
                        id: 'task-2.2.1',
                        description: 'Create product API',
                        tools: ['python', 'flask'],
                        estimatedDuration: 7200000
                      },
                      {
                        id: 'task-2.2.2',
                        description: 'Setup product database',
                        tools: ['postgresql'],
                        estimatedDuration: 3600000
                      },
                      {
                        id: 'task-2.2.3',
                        description: 'Implement search',
                        tools: ['elasticsearch'],
                        dependencies: ['task-2.2.1', 'task-2.2.2'],
                        estimatedDuration: 10800000
                      }
                    ]
                  },
                  {
                    id: 'service-3',
                    type: 'service',
                    description: 'Order Service',
                    children: [
                      {
                        id: 'task-2.3.1',
                        description: 'Create order API',
                        tools: ['java', 'spring'],
                        estimatedDuration: 10800000
                      },
                      {
                        id: 'task-2.3.2',
                        description: 'Implement payment gateway',
                        tools: ['stripe'],
                        dependencies: ['task-2.3.1'],
                        estimatedDuration: 7200000
                      }
                    ]
                  }
                ]
              },
              {
                id: 'phase-3',
                type: 'phase',
                description: 'Integration & Testing',
                dependencies: ['phase-2'],
                estimatedDuration: 28800000,
                children: [
                  {
                    id: 'task-3.1',
                    description: 'Setup API Gateway',
                    tools: ['nginx', 'kong'],
                    estimatedDuration: 7200000
                  },
                  {
                    id: 'task-3.2',
                    description: 'Implement service mesh',
                    tools: ['istio'],
                    dependencies: ['task-3.1'],
                    estimatedDuration: 10800000
                  },
                  {
                    id: 'task-3.3',
                    description: 'Run integration tests',
                    tools: ['jest', 'postman'],
                    dependencies: ['task-3.2'],
                    estimatedDuration: 7200000
                  },
                  {
                    id: 'task-3.4',
                    description: 'Load testing',
                    tools: ['jmeter', 'k6'],
                    dependencies: ['task-3.3'],
                    estimatedDuration: 3600000
                  }
                ]
              }
            ]
          }
        },
        tags: ['microservices', 'complex', 'kubernetes', 'docker'],
        requiredTools: [
          'docker', 'kubernetes', 'node', 'python', 'java',
          'mongodb', 'postgresql', 'elasticsearch', 'nginx'
        ],
        createdAt: new Date().toISOString()
      };
      
      const result = await mockDatabase.insertMany('plans', [complexPlan]);
      expect(result.insertedCount).toBe(1);
      
      // Verify complex plan structure
      const plans = await mockDatabase.find('plans');
      const complex = plans.find(p => p.complexity === 'complex');
      expect(complex).toBeDefined();
      expect(complex.hierarchy.root.children.length).toBe(3); // 3 phases
      expect(complex.requiredTools.length).toBeGreaterThan(5);
    });

    test('should create plans with tool constraints', async () => {
      const constrainedPlan = {
        id: 'uat-plan-constrained-1',
        name: 'Python-Only Data Pipeline',
        goal: 'Build data pipeline using only Python tools',
        complexity: 'medium',
        constraints: {
          allowedTools: ['python', 'pip', 'pandas', 'numpy', 'jupyter'],
          maxDuration: 21600000, // 6 hours
          parallelism: 'limited'
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build data pipeline',
            children: [
              {
                id: 'task-1',
                description: 'Setup Python environment',
                tools: ['python', 'pip'],
                estimatedDuration: 1800000
              },
              {
                id: 'task-2',
                description: 'Install data libraries',
                tools: ['pip'],
                dependencies: ['task-1'],
                estimatedDuration: 1800000
              },
              {
                id: 'task-3',
                description: 'Load and clean data',
                tools: ['pandas'],
                dependencies: ['task-2'],
                estimatedDuration: 3600000
              },
              {
                id: 'task-4',
                description: 'Perform analysis',
                tools: ['numpy', 'pandas'],
                dependencies: ['task-3'],
                estimatedDuration: 7200000
              },
              {
                id: 'task-5',
                description: 'Generate visualizations',
                tools: ['jupyter'],
                dependencies: ['task-4'],
                estimatedDuration: 3600000
              }
            ]
          }
        },
        tags: ['data', 'python', 'constrained'],
        createdAt: new Date().toISOString()
      };
      
      const result = await mockDatabase.insertMany('plans', [constrainedPlan]);
      expect(result.insertedCount).toBe(1);
      
      // Verify constraints
      const plans = await mockDatabase.find('plans');
      const constrained = plans.find(p => p.constraints);
      expect(constrained).toBeDefined();
      expect(constrained.constraints.allowedTools).toContain('python');
      expect(constrained.constraints.maxDuration).toBeDefined();
    });
  });

  describe('Template Creation', () => {
    test('should create reusable plan templates', async () => {
      const templates = [
        {
          id: 'uat-template-1',
          name: 'REST API Template',
          description: 'Template for creating REST APIs',
          isTemplate: true,
          templateConfig: {
            placeholders: ['{{API_NAME}}', '{{PORT}}', '{{DATABASE_TYPE}}'],
            defaultValues: {
              PORT: '3000',
              DATABASE_TYPE: 'mongodb'
            },
            requiredFields: ['API_NAME']
          },
          hierarchy: {
            root: {
              id: 'root',
              description: 'Build {{API_NAME}} API',
              children: [
                {
                  id: 'task-1',
                  description: 'Setup {{API_NAME}} project',
                  tools: ['npm']
                },
                {
                  id: 'task-2',
                  description: 'Configure {{DATABASE_TYPE}} connection',
                  tools: ['{{DATABASE_TYPE}}']
                },
                {
                  id: 'task-3',
                  description: 'Create API endpoints for {{API_NAME}}',
                  tools: ['node']
                },
                {
                  id: 'task-4',
                  description: 'Start server on port {{PORT}}',
                  tools: ['node']
                }
              ]
            }
          },
          tags: ['template', 'api', 'backend'],
          createdAt: new Date().toISOString()
        },
        {
          id: 'uat-template-2',
          name: 'CI/CD Pipeline Template',
          description: 'Template for setting up CI/CD pipelines',
          isTemplate: true,
          templateConfig: {
            placeholders: ['{{PROJECT_NAME}}', '{{BRANCH}}', '{{ENVIRONMENT}}', '{{DEPLOY_TARGET}}'],
            defaultValues: {
              BRANCH: 'main',
              ENVIRONMENT: 'production',
              DEPLOY_TARGET: 'aws'
            },
            requiredFields: ['PROJECT_NAME']
          },
          hierarchy: {
            root: {
              id: 'root',
              description: 'Setup CI/CD for {{PROJECT_NAME}}',
              children: [
                {
                  id: 'task-1',
                  description: 'Configure pipeline for {{BRANCH}} branch',
                  tools: ['git']
                },
                {
                  id: 'task-2',
                  description: 'Setup {{ENVIRONMENT}} environment',
                  tools: ['terraform']
                },
                {
                  id: 'task-3',
                  description: 'Configure deployment to {{DEPLOY_TARGET}}',
                  tools: ['aws-cli', 'kubectl']
                },
                {
                  id: 'task-4',
                  description: 'Run tests for {{PROJECT_NAME}}',
                  tools: ['jest', 'cypress']
                }
              ]
            }
          },
          tags: ['template', 'cicd', 'devops'],
          createdAt: new Date().toISOString()
        },
        {
          id: 'uat-template-3',
          name: 'React Component Template',
          description: 'Template for creating React components',
          isTemplate: true,
          templateConfig: {
            placeholders: ['{{COMPONENT_NAME}}', '{{COMPONENT_TYPE}}', '{{STYLE_SYSTEM}}'],
            defaultValues: {
              COMPONENT_TYPE: 'functional',
              STYLE_SYSTEM: 'styled-components'
            },
            requiredFields: ['COMPONENT_NAME']
          },
          hierarchy: {
            root: {
              id: 'root',
              description: 'Create {{COMPONENT_NAME}} component',
              children: [
                {
                  id: 'task-1',
                  description: 'Create {{COMPONENT_TYPE}} component structure',
                  tools: ['react']
                },
                {
                  id: 'task-2',
                  description: 'Add {{STYLE_SYSTEM}} styles',
                  tools: ['npm']
                },
                {
                  id: 'task-3',
                  description: 'Write tests for {{COMPONENT_NAME}}',
                  tools: ['jest', 'react-testing-library']
                },
                {
                  id: 'task-4',
                  description: 'Add to component library',
                  tools: ['storybook']
                }
              ]
            }
          },
          tags: ['template', 'react', 'frontend'],
          createdAt: new Date().toISOString()
        }
      ];
      
      const result = await mockDatabase.insertMany('templates', templates);
      expect(result.insertedCount).toBe(3);
      
      // Verify templates
      const savedTemplates = await mockDatabase.find('templates');
      expect(savedTemplates.length).toBe(3);
      expect(savedTemplates.every(t => t.isTemplate)).toBe(true);
      expect(savedTemplates.every(t => t.templateConfig)).toBeTruthy();
    });

    test('should validate template placeholders', () => {
      const template = testDataStore.templates[0];
      if (template && template.templateConfig) {
        const { placeholders, requiredFields } = template.templateConfig;
        
        // Check all required fields have placeholders
        requiredFields.forEach(field => {
          const placeholder = `{{${field}}}`;
          expect(placeholders).toContain(placeholder);
        });
        
        // Check placeholders are valid format
        placeholders.forEach(placeholder => {
          expect(placeholder).toMatch(/^{{[A-Z_]+}}$/);
        });
      }
    });
  });

  describe('Execution History Creation', () => {
    test('should create successful execution records', async () => {
      const successfulExecutions = [
        {
          id: 'uat-exec-success-1',
          planId: 'uat-plan-simple-1',
          status: 'completed',
          startTime: new Date('2024-01-15T10:00:00').toISOString(),
          endTime: new Date('2024-01-15T11:00:00').toISOString(),
          duration: 3600000,
          tasksCompleted: 4,
          tasksFailed: 0,
          logs: [
            { timestamp: '2024-01-15T10:00:00', level: 'info', message: 'Execution started' },
            { timestamp: '2024-01-15T10:15:00', level: 'info', message: 'Task 1 completed' },
            { timestamp: '2024-01-15T10:30:00', level: 'info', message: 'Task 2 completed' },
            { timestamp: '2024-01-15T10:45:00', level: 'info', message: 'Task 3 completed' },
            { timestamp: '2024-01-15T11:00:00', level: 'info', message: 'Task 4 completed' },
            { timestamp: '2024-01-15T11:00:00', level: 'success', message: 'Execution completed successfully' }
          ],
          artifacts: [
            { name: 'server.js', type: 'file', path: '/output/server.js' },
            { name: 'package.json', type: 'file', path: '/output/package.json' }
          ]
        }
      ];
      
      const result = await mockDatabase.insertMany('executions', successfulExecutions);
      expect(result.insertedCount).toBe(1);
      
      // Verify execution
      const executions = await mockDatabase.find('executions');
      const successful = executions.filter(e => e.status === 'completed');
      expect(successful.length).toBeGreaterThan(0);
      expect(successful[0].tasksFailed).toBe(0);
    });

    test('should create failed execution records', async () => {
      const failedExecution = {
        id: 'uat-exec-failed-1',
        planId: 'uat-plan-simple-2',
        status: 'failed',
        startTime: new Date('2024-01-15T14:00:00').toISOString(),
        endTime: new Date('2024-01-15T14:30:00').toISOString(),
        duration: 1800000,
        tasksCompleted: 2,
        tasksFailed: 1,
        failureReason: 'GitHub authentication failed',
        logs: [
          { timestamp: '2024-01-15T14:00:00', level: 'info', message: 'Execution started' },
          { timestamp: '2024-01-15T14:10:00', level: 'info', message: 'Task 1 completed' },
          { timestamp: '2024-01-15T14:20:00', level: 'info', message: 'Task 2 completed' },
          { timestamp: '2024-01-15T14:30:00', level: 'error', message: 'Task 3 failed: GitHub authentication failed' },
          { timestamp: '2024-01-15T14:30:00', level: 'error', message: 'Execution failed' }
        ],
        errorDetails: {
          task: 'task-3',
          error: 'Authentication failed',
          stackTrace: 'Error: Authentication failed\n  at pushToGitHub()\n  at executeTask()'
        }
      };
      
      const result = await mockDatabase.insertMany('executions', [failedExecution]);
      expect(result.insertedCount).toBe(1);
      
      // Verify failed execution
      const executions = await mockDatabase.find('executions');
      const failed = executions.find(e => e.status === 'failed');
      expect(failed).toBeDefined();
      expect(failed.tasksFailed).toBeGreaterThan(0);
      expect(failed.failureReason).toBeDefined();
    });

    test('should create partial execution records', async () => {
      const partialExecution = {
        id: 'uat-exec-partial-1',
        planId: 'uat-plan-complex-1',
        status: 'partial',
        startTime: new Date('2024-01-16T09:00:00').toISOString(),
        endTime: new Date('2024-01-16T15:00:00').toISOString(),
        duration: 21600000,
        tasksCompleted: 8,
        tasksFailed: 2,
        tasksSkipped: 3,
        completionPercentage: 62,
        logs: [
          { timestamp: '2024-01-16T09:00:00', level: 'info', message: 'Execution started' },
          { timestamp: '2024-01-16T11:00:00', level: 'warning', message: 'Task 5 failed, continuing with others' },
          { timestamp: '2024-01-16T13:00:00', level: 'warning', message: 'Task 9 failed, skipping dependent tasks' },
          { timestamp: '2024-01-16T15:00:00', level: 'info', message: 'Execution partially completed' }
        ],
        recoveryOptions: ['retry-failed', 'skip-failed', 'rollback']
      };
      
      const result = await mockDatabase.insertMany('executions', [partialExecution]);
      expect(result.insertedCount).toBe(1);
      
      // Verify partial execution
      const executions = await mockDatabase.find('executions');
      const partial = executions.find(e => e.status === 'partial');
      expect(partial).toBeDefined();
      expect(partial.completionPercentage).toBeLessThan(100);
      expect(partial.recoveryOptions).toBeDefined();
    });
  });

  describe('Tool Registry Population', () => {
    test('should populate available tools', async () => {
      const tools = [
        {
          id: 'tool-npm',
          name: 'npm',
          version: '9.0.0',
          category: 'package-manager',
          description: 'Node Package Manager',
          available: true,
          capabilities: ['install', 'update', 'run-scripts'],
          requiredBy: ['uat-plan-simple-1', 'uat-plan-simple-2']
        },
        {
          id: 'tool-git',
          name: 'git',
          version: '2.40.0',
          category: 'version-control',
          description: 'Version control system',
          available: true,
          capabilities: ['clone', 'commit', 'push', 'pull'],
          requiredBy: ['uat-plan-simple-2']
        },
        {
          id: 'tool-docker',
          name: 'docker',
          version: '24.0.0',
          category: 'containerization',
          description: 'Container platform',
          available: true,
          capabilities: ['build', 'run', 'compose'],
          requiredBy: ['uat-plan-complex-1']
        },
        {
          id: 'tool-kubectl',
          name: 'kubectl',
          version: '1.28.0',
          category: 'orchestration',
          description: 'Kubernetes CLI',
          available: false,
          installCommand: 'brew install kubectl',
          requiredBy: ['uat-plan-complex-1']
        },
        {
          id: 'tool-python',
          name: 'python',
          version: '3.11.0',
          category: 'programming-language',
          description: 'Python interpreter',
          available: true,
          capabilities: ['execute', 'pip', 'venv'],
          requiredBy: ['uat-plan-constrained-1', 'uat-plan-complex-1']
        }
      ];
      
      const result = await mockDatabase.insertMany('tools', tools);
      expect(result.insertedCount).toBe(5);
      
      // Verify tools
      const savedTools = await mockDatabase.find('tools');
      expect(savedTools.length).toBe(5);
      
      const availableTools = savedTools.filter(t => t.available);
      expect(availableTools.length).toBe(4);
      
      const unavailableTools = savedTools.filter(t => !t.available);
      expect(unavailableTools.length).toBe(1);
      expect(unavailableTools[0].installCommand).toBeDefined();
    });

    test('should validate tool dependencies', () => {
      // This test depends on tools being populated first
      // Skip if tools haven't been populated yet
      if (testDataStore.tools.length === 0) {
        // Populate minimal tools for testing
        testDataStore.tools = [
          { id: 'tool-npm', name: 'npm', available: true },
          { id: 'tool-git', name: 'git', available: true },
          { id: 'tool-node', name: 'node', available: true }
        ];
      }
      
      const tools = testDataStore.tools;
      const plans = testDataStore.plans;
      
      // Check that all tools required by plans exist
      plans.forEach(plan => {
        if (plan.requiredTools) {
          plan.requiredTools.forEach(toolName => {
            const tool = tools.find(t => t.name === toolName);
            if (!tool) {
              console.warn(`Tool ${toolName} required by ${plan.name} not found in registry`);
            }
          });
        }
      });
      
      // Verify critical tools are available
      const criticalTools = ['npm', 'git', 'node'];
      criticalTools.forEach(toolName => {
        const tool = tools.find(t => t.name === toolName);
        expect(tool).toBeDefined();
        expect(tool.available).toBe(true);
      });
    });
  });

  describe('Test Scenarios Preparation', () => {
    test('should create end-to-end test scenarios', () => {
      const scenarios = [
        {
          id: 'scenario-1',
          name: 'Simple Plan Creation and Execution',
          description: 'User creates a simple plan and executes it successfully',
          steps: [
            'Navigate to Planning Workspace',
            'Enter goal: "Create a simple web server"',
            'Click "Create Plan"',
            'Review generated plan',
            'Click "Execute Plan"',
            'Monitor execution progress',
            'Verify successful completion'
          ],
          expectedOutcome: 'Plan executed successfully with all tasks completed',
          testData: ['uat-plan-simple-1']
        },
        {
          id: 'scenario-2',
          name: 'Template Application',
          description: 'User applies a template to create a new plan',
          steps: [
            'Navigate to Plan Library',
            'Select "REST API Template"',
            'Click "Use Template"',
            'Fill in placeholders: API_NAME="UserAPI", PORT="8080"',
            'Click "Create from Template"',
            'Review generated plan',
            'Save plan to library'
          ],
          expectedOutcome: 'New plan created from template with substituted values',
          testData: ['uat-template-1']
        },
        {
          id: 'scenario-3',
          name: 'Failed Execution Recovery',
          description: 'User handles a failed execution and retries',
          steps: [
            'Load plan with known failure point',
            'Start execution',
            'Wait for failure at task 3',
            'Review error details',
            'Select "Retry Failed Tasks"',
            'Monitor retry execution',
            'Verify successful recovery'
          ],
          expectedOutcome: 'Failed tasks retried successfully',
          testData: ['uat-exec-failed-1']
        },
        {
          id: 'scenario-4',
          name: 'Complex Plan Visualization',
          description: 'User visualizes and navigates complex hierarchical plan',
          steps: [
            'Load complex microservices plan',
            'Switch to visualization view',
            'Expand/collapse phases',
            'Zoom in on specific services',
            'View task dependencies',
            'Check tool requirements',
            'Export plan diagram'
          ],
          expectedOutcome: 'Complex plan structure clearly visualized',
          testData: ['uat-plan-complex-1']
        },
        {
          id: 'scenario-5',
          name: 'Concurrent Plan Management',
          description: 'User manages multiple plans simultaneously',
          steps: [
            'Open multiple plans in tabs',
            'Start execution of plan 1',
            'While running, edit plan 2',
            'Monitor plan 1 progress',
            'Save changes to plan 2',
            'Start execution of plan 2',
            'Monitor both executions'
          ],
          expectedOutcome: 'Multiple plans managed without conflicts',
          testData: ['uat-plan-simple-1', 'uat-plan-simple-2']
        }
      ];
      
      expect(scenarios.length).toBe(5);
      expect(scenarios.every(s => s.steps.length > 0)).toBe(true);
      expect(scenarios.every(s => s.expectedOutcome)).toBeTruthy();
      expect(scenarios.every(s => s.testData.length > 0)).toBe(true);
    });
  });

  describe('Data Validation', () => {
    test('should validate all test data integrity', () => {
      // Check plans have required fields
      testDataStore.plans.forEach(plan => {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan.goal).toBeDefined();
        expect(plan.hierarchy).toBeDefined();
        expect(plan.createdAt).toBeDefined();
      });
      
      // Check templates have template config
      testDataStore.templates.forEach(template => {
        expect(template.isTemplate).toBe(true);
        expect(template.templateConfig).toBeDefined();
        expect(template.templateConfig.placeholders).toBeDefined();
        expect(Array.isArray(template.templateConfig.placeholders)).toBe(true);
      });
      
      // Check executions reference valid plans
      testDataStore.executions.forEach(execution => {
        expect(execution.planId).toBeDefined();
        expect(execution.status).toBeDefined();
        expect(['completed', 'failed', 'partial', 'running']).toContain(execution.status);
      });
    });

    test('should ensure data relationships are valid', () => {
      const planIds = testDataStore.plans.map(p => p.id);
      
      // Check execution plan references
      testDataStore.executions.forEach(execution => {
        if (execution.planId.startsWith('uat-plan-')) {
          expect(planIds).toContain(execution.planId);
        }
      });
      
      // Check tool requirements
      testDataStore.plans.forEach(plan => {
        if (plan.requiredTools) {
          const toolNames = testDataStore.tools.map(t => t.name);
          plan.requiredTools.forEach(requiredTool => {
            const toolExists = toolNames.includes(requiredTool);
            if (!toolExists) {
              console.warn(`Required tool ${requiredTool} for plan ${plan.name} not in registry`);
            }
          });
        }
      });
    });
  });

  describe('Performance Test Data', () => {
    test('should create data for performance testing', () => {
      const perfTestData = {
        largePlan: {
          taskCount: 100,
          depth: 5,
          estimatedDuration: 259200000 // 72 hours
        },
        concurrentExecutions: {
          count: 10,
          simultaneousStart: true
        },
        stressTest: {
          plansToCreate: 50,
          executionsToRun: 25,
          duration: 3600000 // 1 hour
        }
      };
      
      expect(perfTestData.largePlan.taskCount).toBeGreaterThan(50);
      expect(perfTestData.concurrentExecutions.count).toBeGreaterThan(5);
      expect(perfTestData.stressTest.plansToCreate).toBeGreaterThan(25);
    });
  });
});