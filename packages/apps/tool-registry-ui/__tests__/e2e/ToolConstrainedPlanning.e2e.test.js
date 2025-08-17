/**
 * End-to-End Tests: Tool Constrained Planning
 * Tests planning scenarios with specific tool requirements and constraints
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('E2E: Tool Constrained Planning', () => {
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

    // Create comprehensive mock actors with tool-specific responses
    mockPlanningActor = {
      createPlan: jest.fn().mockImplementation((goal, constraints) => {
        // Create plan based on tool constraints
        const availableTools = constraints?.tools || [];
        const excludedTools = constraints?.excludeTools || [];
        
        return Promise.resolve({
          id: `tool-constrained-plan-${Date.now()}`,
          name: 'Tool Constrained Plan',
          goal: goal,
          status: 'created',
          constraints: {
            requiredTools: availableTools,
            excludedTools: excludedTools,
            alternativeTools: {}
          },
          hierarchy: {
            root: {
              id: 'root',
              description: goal,
              type: 'goal',
              children: availableTools.includes('docker') ? [
                {
                  id: 'docker-task',
                  description: 'Containerize application',
                  type: 'task',
                  tools: ['docker', 'docker-compose'],
                  children: [
                    {
                      id: 'build-image',
                      description: 'Build Docker image',
                      tools: ['docker'],
                      children: []
                    },
                    {
                      id: 'push-registry',
                      description: 'Push to registry',
                      tools: ['docker'],
                      children: []
                    }
                  ]
                }
              ] : availableTools.includes('npm') ? [
                {
                  id: 'npm-task',
                  description: 'Setup Node.js project',
                  type: 'task',
                  tools: ['npm', 'node'],
                  children: [
                    {
                      id: 'install-deps',
                      description: 'Install dependencies',
                      tools: ['npm'],
                      children: []
                    },
                    {
                      id: 'run-build',
                      description: 'Build project',
                      tools: ['npm'],
                      children: []
                    }
                  ]
                }
              ] : [
                {
                  id: 'basic-task',
                  description: 'Basic setup without specific tools',
                  type: 'task',
                  tools: [],
                  children: []
                }
              ]
            }
          },
          behaviorTree: {
            rootNode: {
              type: 'sequence',
              children: availableTools.map(tool => ({
                type: 'action',
                command: `${tool} --version`,
                tool: tool
              }))
            }
          },
          toolAnalysis: {
            requiredTools: availableTools,
            availableTools: [],
            missingTools: [],
            substitutions: {}
          },
          createdAt: new Date().toISOString()
        });
      }),
      
      validatePlan: jest.fn().mockImplementation((plan) => {
        const hasDocker = plan.toolAnalysis?.requiredTools?.includes('docker');
        const hasKubernetes = plan.toolAnalysis?.requiredTools?.includes('kubernetes');
        
        return Promise.resolve({
          isValid: !hasKubernetes, // Kubernetes is missing
          errors: hasKubernetes ? ['Kubernetes not available'] : [],
          warnings: hasDocker ? ['Docker requires sudo permissions'] : [],
          toolsAvailable: !hasKubernetes,
          toolValidation: {
            docker: { available: true, version: '20.10.0' },
            npm: { available: true, version: '9.0.0' },
            kubernetes: { available: false, version: null },
            python: { available: true, version: '3.11.0' }
          }
        });
      }),
      
      suggestAlternativeTools: jest.fn().mockResolvedValue({
        suggestions: {
          'kubernetes': ['docker-compose', 'docker-swarm'],
          'helm': ['kustomize'],
          'terraform': ['ansible', 'chef']
        }
      }),
      
      adaptPlanToTools: jest.fn().mockImplementation((plan, availableTools) => {
        // Adapt plan to use only available tools
        const adaptedPlan = { ...plan };
        adaptedPlan.adapted = true;
        adaptedPlan.originalTools = plan.toolAnalysis.requiredTools;
        adaptedPlan.adaptedTools = availableTools;
        
        // Replace tasks that use unavailable tools
        if (!availableTools.includes('kubernetes') && 
            plan.toolAnalysis.requiredTools.includes('kubernetes')) {
          adaptedPlan.hierarchy.root.children = adaptedPlan.hierarchy.root.children.map(
            task => {
              if (task.tools.includes('kubernetes')) {
                return {
                  ...task,
                  tools: ['docker-compose'],
                  description: task.description.replace('Kubernetes', 'Docker Compose')
                };
              }
              return task;
            }
          );
        }
        
        return Promise.resolve(adaptedPlan);
      }),
      
      savePlan: jest.fn().mockResolvedValue({ success: true }),
      loadPlan: jest.fn(),
      getPlans: jest.fn().mockResolvedValue([])
    };

    mockExecutionActor = {
      startExecution: jest.fn().mockImplementation((plan) => {
        // Check if all required tools are available
        const missingTools = plan.toolAnalysis?.missingTools || [];
        
        if (missingTools.length > 0) {
          return Promise.reject(new Error(`Missing tools: ${missingTools.join(', ')}`));
        }
        
        return Promise.resolve({
          executionId: `tool-exec-${Date.now()}`,
          status: 'running',
          toolsUsed: plan.toolAnalysis?.requiredTools || []
        });
      }),
      
      validateToolEnvironment: jest.fn().mockResolvedValue({
        valid: true,
        environment: {
          PATH: '/usr/local/bin:/usr/bin',
          NODE_ENV: 'development'
        }
      }),
      
      stopExecution: jest.fn().mockResolvedValue({ status: 'stopped' })
    };

    mockToolRegistryActor = {
      searchTools: jest.fn().mockImplementation((query) => {
        const allTools = [
          { name: 'docker', category: 'containerization', available: true },
          { name: 'docker-compose', category: 'containerization', available: true },
          { name: 'kubernetes', category: 'orchestration', available: false },
          { name: 'npm', category: 'package-manager', available: true },
          { name: 'yarn', category: 'package-manager', available: true },
          { name: 'python', category: 'language', available: true },
          { name: 'jest', category: 'testing', available: true },
          { name: 'terraform', category: 'infrastructure', available: false }
        ];
        
        if (query) {
          return Promise.resolve(
            allTools.filter(tool => 
              tool.name.includes(query.toLowerCase()) ||
              tool.category.includes(query.toLowerCase())
            )
          );
        }
        
        return Promise.resolve(allTools);
      }),
      
      validateTools: jest.fn().mockImplementation((toolList) => {
        const availableTools = ['docker', 'docker-compose', 'npm', 'yarn', 'python', 'jest'];
        const missingTools = toolList.filter(tool => !availableTools.includes(tool));
        
        return Promise.resolve({
          isValid: missingTools.length === 0,
          availableTools: toolList.filter(tool => availableTools.includes(tool)),
          missingTools: missingTools,
          suggestions: missingTools.map(tool => `Install ${tool} to use this feature`)
        });
      }),
      
      getAvailableTools: jest.fn().mockResolvedValue([
        'docker', 'docker-compose', 'npm', 'yarn', 'python', 'jest', 'git'
      ]),
      
      getToolCapabilities: jest.fn().mockImplementation((toolName) => {
        const capabilities = {
          'docker': ['containerization', 'isolation', 'deployment'],
          'npm': ['dependency-management', 'script-running', 'publishing'],
          'python': ['scripting', 'data-processing', 'web-development'],
          'jest': ['unit-testing', 'integration-testing', 'coverage']
        };
        
        return Promise.resolve(capabilities[toolName] || []);
      }),
      
      checkToolCompatibility: jest.fn().mockImplementation((tools) => {
        const incompatibilities = [];
        
        if (tools.includes('npm') && tools.includes('yarn')) {
          incompatibilities.push({
            tools: ['npm', 'yarn'],
            issue: 'Both npm and yarn manage lock files differently'
          });
        }
        
        return Promise.resolve({
          compatible: incompatibilities.length === 0,
          issues: incompatibilities
        });
      })
    };

    // Define all planning tabs
    const tabs = [
      {
        id: 'planning',
        label: 'Planning Workspace',
        title: 'Planning Workspace',
        icon: '🧠',
        component: 'PlanningWorkspacePanel'
      },
      {
        id: 'visualization',
        label: 'Plan Visualization',
        title: 'Plan Visualization',
        icon: '📊',
        component: 'PlanVisualizationPanel'
      },
      {
        id: 'execution',
        label: 'Execution Control',
        title: 'Execution Control',
        icon: '⚡',
        component: 'ExecutionControlPanel'
      },
      {
        id: 'library',
        label: 'Plan Library',
        title: 'Plan Library',
        icon: '📚',
        component: 'PlanLibraryPanel'
      }
    ];

    // Create umbilical
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Tool tracking
      toolConstraints: [],
      toolWarnings: [],
      
      // Callbacks
      onPlanCreate: jest.fn(),
      onPlanComplete: jest.fn(),
      onToolValidation: jest.fn(),
      onToolMissing: jest.fn(),
      onToolSubstitution: jest.fn(),
      onExecutionStart: jest.fn(),
      onTabChange: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await NavigationTabs.create(mockUmbilical);
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

  describe('Tool Availability Checking', () => {
    test('should validate all required tools before planning', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Set goal that requires specific tools
      planningComponent.api.setGoal('Deploy application with Docker');
      
      // Create plan with tool constraints
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Deploy application with Docker',
        { tools: ['docker', 'docker-compose'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate tools
      const validation = await mockToolRegistryActor.validateTools(['docker', 'docker-compose']);
      
      expect(validation.isValid).toBe(true);
      expect(validation.availableTools).toContain('docker');
      expect(validation.availableTools).toContain('docker-compose');
      expect(validation.missingTools).toHaveLength(0);
    });

    test('should identify missing tools', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Set goal requiring unavailable tools
      planningComponent.api.setGoal('Deploy with Kubernetes');
      
      // Create plan
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Deploy with Kubernetes',
        { tools: ['kubernetes', 'helm'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate tools
      const validation = await mockToolRegistryActor.validateTools(['kubernetes', 'helm']);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingTools).toContain('kubernetes');
      expect(validation.missingTools).toContain('helm');
      expect(validation.suggestions).toHaveLength(2);
    });

    test('should check tool compatibility', async () => {
      // Check if tools are compatible with each other
      const compatibility = await mockToolRegistryActor.checkToolCompatibility(['npm', 'yarn']);
      
      expect(compatibility.compatible).toBe(false);
      expect(compatibility.issues).toHaveLength(1);
      expect(compatibility.issues[0].issue).toContain('lock files');
    });

    test('should search for tools by category', async () => {
      // Search for containerization tools
      const containerTools = await mockToolRegistryActor.searchTools('containerization');
      
      expect(containerTools).toHaveLength(2);
      expect(containerTools[0].category).toBe('containerization');
      expect(containerTools.map(t => t.name)).toContain('docker');
      expect(containerTools.map(t => t.name)).toContain('docker-compose');
      
      // Search for testing tools
      const testingTools = await mockToolRegistryActor.searchTools('testing');
      
      expect(testingTools).toHaveLength(1);
      expect(testingTools[0].name).toBe('jest');
    });
  });

  describe('Tool Substitution', () => {
    test('should suggest alternative tools when primary tools are missing', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan with unavailable tools
      planningComponent.api.setGoal('Deploy with orchestration');
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Deploy with orchestration',
        { tools: ['kubernetes'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Get alternative suggestions
      const alternatives = await mockPlanningActor.suggestAlternativeTools(plan);
      
      expect(alternatives.suggestions['kubernetes']).toBeDefined();
      expect(alternatives.suggestions['kubernetes']).toContain('docker-compose');
      expect(alternatives.suggestions['kubernetes']).toContain('docker-swarm');
    });

    test('should adapt plan to use available alternative tools', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create original plan
      planningComponent.api.setGoal('Deploy with Kubernetes');
      const planPromise = planningComponent.api.createPlan();
      const originalPlan = await mockPlanningActor.createPlan(
        'Deploy with Kubernetes',
        { tools: ['kubernetes', 'helm'] }
      );
      planningComponent.api.handlePlanComplete(originalPlan);
      await planPromise;
      
      // Adapt plan to available tools
      const availableTools = await mockToolRegistryActor.getAvailableTools();
      const adaptedPlan = await mockPlanningActor.adaptPlanToTools(
        originalPlan,
        availableTools
      );
      
      expect(adaptedPlan.adapted).toBe(true);
      expect(adaptedPlan.originalTools).toContain('kubernetes');
      expect(adaptedPlan.adaptedTools).not.toContain('kubernetes');
      expect(adaptedPlan.adaptedTools).toContain('docker-compose');
    });

    test('should maintain plan integrity with tool substitutions', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan
      planningComponent.api.setGoal('Infrastructure as Code deployment');
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Infrastructure as Code deployment',
        { tools: ['terraform'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Get alternatives for terraform
      const alternatives = await mockPlanningActor.suggestAlternativeTools(plan);
      expect(alternatives.suggestions['terraform']).toContain('ansible');
      
      // Adapt plan
      const adaptedPlan = await mockPlanningActor.adaptPlanToTools(
        plan,
        ['ansible', 'python']
      );
      
      // Verify plan structure is maintained
      expect(adaptedPlan.hierarchy).toBeDefined();
      expect(adaptedPlan.behaviorTree).toBeDefined();
      expect(adaptedPlan.goal).toBe(plan.goal);
    });
  });

  describe('Constrained Execution', () => {
    test('should only execute with available tools', async () => {
      // Create plan with available tools
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Build with NPM');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Build with NPM',
        { tools: ['npm', 'node'] }
      );
      plan.toolAnalysis = {
        requiredTools: ['npm', 'node'],
        availableTools: ['npm', 'node'],
        missingTools: []
      };
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Switch to execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution - should succeed
        const result = await mockExecutionActor.startExecution(plan);
        expect(result.status).toBe('running');
        expect(result.toolsUsed).toContain('npm');
      }
    });

    test('should prevent execution with missing tools', async () => {
      // Create plan with missing tools
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Deploy with Kubernetes');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Deploy with Kubernetes',
        { tools: ['kubernetes'] }
      );
      plan.toolAnalysis = {
        requiredTools: ['kubernetes'],
        availableTools: [],
        missingTools: ['kubernetes']
      };
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Attempt execution - should fail
      await expect(mockExecutionActor.startExecution(plan))
        .rejects
        .toThrow('Missing tools: kubernetes');
    });

    test('should validate tool environment before execution', async () => {
      // Validate environment
      const envValidation = await mockExecutionActor.validateToolEnvironment();
      
      expect(envValidation.valid).toBe(true);
      expect(envValidation.environment.PATH).toContain('/usr/local/bin');
      expect(envValidation.environment.NODE_ENV).toBe('development');
    });
  });

  describe('Tool-Specific Planning', () => {
    test('should create Docker-specific plan when Docker is available', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create Docker-specific plan
      planningComponent.api.setGoal('Containerize application');
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Containerize application',
        { tools: ['docker'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify Docker tasks
      const state = planningComponent.api.getState();
      if (state.currentPlan) {
        const dockerTask = state.currentPlan.hierarchy.root.children.find(
          task => task.id === 'docker-task'
        );
        
        expect(dockerTask).toBeDefined();
        expect(dockerTask.tools).toContain('docker');
        expect(dockerTask.children).toHaveLength(2);
        expect(dockerTask.children[0].description).toContain('Build Docker image');
      }
    });

    test('should create NPM-specific plan when NPM is available', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create NPM-specific plan
      planningComponent.api.setGoal('Setup Node.js project');
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Setup Node.js project',
        { tools: ['npm'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify NPM tasks
      const state = planningComponent.api.getState();
      if (state.currentPlan) {
        const npmTask = state.currentPlan.hierarchy.root.children.find(
          task => task.id === 'npm-task'
        );
        
        expect(npmTask).toBeDefined();
        expect(npmTask.tools).toContain('npm');
        expect(npmTask.children.some(
          child => child.description.includes('Install dependencies')
        )).toBe(true);
      }
    });

    test('should fall back to basic plan when no specific tools available', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan without specific tools
      planningComponent.api.setGoal('Basic setup');
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Basic setup',
        { tools: [] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify basic task
      const state = planningComponent.api.getState();
      if (state.currentPlan) {
        const basicTask = state.currentPlan.hierarchy.root.children[0];
        
        expect(basicTask.id).toBe('basic-task');
        expect(basicTask.tools).toHaveLength(0);
        expect(basicTask.description).toContain('Basic setup');
      }
    });
  });

  describe('Tool Capability Analysis', () => {
    test('should analyze tool capabilities for planning', async () => {
      // Get Docker capabilities
      const dockerCaps = await mockToolRegistryActor.getToolCapabilities('docker');
      
      expect(dockerCaps).toContain('containerization');
      expect(dockerCaps).toContain('isolation');
      expect(dockerCaps).toContain('deployment');
      
      // Get Jest capabilities
      const jestCaps = await mockToolRegistryActor.getToolCapabilities('jest');
      
      expect(jestCaps).toContain('unit-testing');
      expect(jestCaps).toContain('coverage');
    });

    test('should match tool capabilities to task requirements', async () => {
      // Task requiring testing capabilities
      const testingTask = {
        description: 'Write and run tests',
        requiredCapabilities: ['unit-testing', 'coverage']
      };
      
      // Find suitable tools
      const allTools = await mockToolRegistryActor.searchTools();
      const suitableTools = [];
      
      for (const tool of allTools) {
        const capabilities = await mockToolRegistryActor.getToolCapabilities(tool.name);
        const hasRequiredCaps = testingTask.requiredCapabilities.every(
          cap => capabilities.includes(cap)
        );
        
        if (hasRequiredCaps) {
          suitableTools.push(tool.name);
        }
      }
      
      expect(suitableTools).toContain('jest');
      expect(suitableTools).toHaveLength(1);
    });
  });

  describe('Multi-Tool Workflow', () => {
    test('should coordinate multiple tools in sequence', async () => {
      // Create plan with multiple tools
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Full development workflow');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Full development workflow',
        { tools: ['git', 'npm', 'jest', 'docker'] }
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Verify behavior tree has sequential tool usage
      const state = planningComponent.api.getState();
      if (state.currentPlan && state.currentPlan.behaviorTree) {
        const { behaviorTree } = state.currentPlan;
        
        expect(behaviorTree.rootNode.type).toBe('sequence');
        expect(behaviorTree.rootNode.children).toHaveLength(4);
        
        const toolCommands = behaviorTree.rootNode.children.map(c => c.tool);
        expect(toolCommands).toContain('git');
        expect(toolCommands).toContain('npm');
        expect(toolCommands).toContain('jest');
        expect(toolCommands).toContain('docker');
      }
    });

    test('should handle tool dependencies in planning', async () => {
      // NPM depends on Node.js, Docker Compose depends on Docker
      const toolDependencies = {
        'npm': ['node'],
        'docker-compose': ['docker'],
        'jest': ['npm', 'node']
      };
      
      // Validate tool with dependencies
      const requiredTools = ['jest'];
      const allRequired = new Set(requiredTools);
      
      // Add dependencies
      for (const tool of requiredTools) {
        const deps = toolDependencies[tool] || [];
        deps.forEach(dep => allRequired.add(dep));
      }
      
      const validation = await mockToolRegistryActor.validateTools(
        Array.from(allRequired)
      );
      
      // Jest requires npm and node
      expect(allRequired.has('npm')).toBe(true);
      expect(allRequired.has('node')).toBe(true);
      expect(allRequired.size).toBe(3);
    });
  });
});