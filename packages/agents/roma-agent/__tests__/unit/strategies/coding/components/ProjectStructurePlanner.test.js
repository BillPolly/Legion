/**
 * Unit tests for ProjectStructurePlanner
 * Tests project plan generation, phase breakdown, and task creation
 * NO MOCKS - using real services where needed
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import ProjectStructurePlanner from '../../../../../src/strategies/coding/components/ProjectStructurePlanner.js';

describe('ProjectStructurePlanner', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;

  beforeEach(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();
  });

  describe('Constructor', () => {
    test('should create planner with LLM client and tool registry', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      expect(planner).toBeDefined();
      expect(planner.llmClient).toBe(llmClient);
      expect(planner.toolRegistry).toBe(toolRegistry);
    });

    test('should throw error if no LLM client provided', () => {
      expect(() => new ProjectStructurePlanner()).toThrow('LLM client is required');
    });

    test('should throw error if no tool registry provided', () => {
      expect(() => new ProjectStructurePlanner(llmClient)).toThrow('Tool registry is required');
    });
  });

  describe('createPlan() method', () => {
    test('should create plan with all phases', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const requirements = {
        type: 'api',
        features: ['authentication', 'crud'],
        constraints: ['secure'],
        technologies: ['express', 'mongodb']
      };
      
      const plan = await planner.createPlan(requirements);
      
      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.projectId).toBeDefined();
      expect(plan.version).toBe(1);
      expect(Array.isArray(plan.phases)).toBe(true);
      expect(plan.phases.length).toBe(5); // setup, core, features, testing, integration
    });

    test('should generate unique plan and project IDs', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const requirements = {
        type: 'api',
        features: [],
        constraints: [],
        technologies: []
      };
      
      const plan1 = await planner.createPlan(requirements);
      const plan2 = await planner.createPlan(requirements);
      
      expect(plan1.planId).not.toBe(plan2.planId);
      expect(plan1.projectId).not.toBe(plan2.projectId);
    });

    test('should include parallelization config', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const plan = await planner.createPlan({
        type: 'api',
        features: [],
        constraints: [],
        technologies: []
      });
      
      expect(plan.parallelization).toBeDefined();
      expect(plan.parallelization.maxConcurrent).toBeGreaterThan(0);
      expect(['aggressive', 'balanced', 'conservative']).toContain(plan.parallelization.strategy);
    });

    test('should include error handling config', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const plan = await planner.createPlan({
        type: 'api',
        features: [],
        constraints: [],
        technologies: []
      });
      
      expect(plan.errorHandling).toBeDefined();
      expect(['fail-fast', 'continue-on-error', 'selective']).toContain(plan.errorHandling.strategy);
      expect(plan.errorHandling.recovery).toBeDefined();
    });
  });

  describe('generateStructure() method', () => {
    test('should generate API project structure', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const structure = await planner.generateStructure({
        type: 'api',
        features: ['authentication', 'database'],
        constraints: [],
        technologies: ['express']
      });
      
      expect(structure).toBeDefined();
      expect(structure.rootPath).toBeDefined();
      expect(Array.isArray(structure.directories)).toBe(true);
      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('tests');
      expect(Array.isArray(structure.files)).toBe(true);
    });

    test('should generate web project structure', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const structure = await planner.generateStructure({
        type: 'web',
        features: ['dashboard'],
        constraints: [],
        technologies: ['react']
      });
      
      expect(structure).toBeDefined();
      expect(structure.directories).toContain('public');
      expect(structure.directories).toContain('src');
    });

    test('should generate CLI project structure', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const structure = await planner.generateStructure({
        type: 'cli',
        features: [],
        constraints: [],
        technologies: []
      });
      
      expect(structure).toBeDefined();
      expect(structure.directories).toContain('bin');
      expect(structure.directories).toContain('lib');
    });

    test('should generate library project structure', async () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const structure = await planner.generateStructure({
        type: 'library',
        features: [],
        constraints: [],
        technologies: []
      });
      
      expect(structure).toBeDefined();
      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('dist');
    });
  });

  describe('createPhases() method', () => {
    test('should create setup phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phases = planner.createPhases({ type: 'api', features: [] });
      const setupPhase = phases.find(p => p.phase === 'setup');
      
      expect(setupPhase).toBeDefined();
      expect(setupPhase.priority).toBe(1);
      expect(Array.isArray(setupPhase.tasks)).toBe(true);
      expect(setupPhase.tasks.length).toBeGreaterThan(0);
    });

    test('should create core phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phases = planner.createPhases({ type: 'api', features: [] });
      const corePhase = phases.find(p => p.phase === 'core');
      
      expect(corePhase).toBeDefined();
      expect(corePhase.priority).toBe(2);
      expect(Array.isArray(corePhase.tasks)).toBe(true);
    });

    test('should create features phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phases = planner.createPhases({ 
        type: 'api', 
        features: ['authentication', 'validation'] 
      });
      const featuresPhase = phases.find(p => p.phase === 'features');
      
      expect(featuresPhase).toBeDefined();
      expect(featuresPhase.priority).toBe(3);
      expect(featuresPhase.tasks.length).toBeGreaterThan(0);
    });

    test('should create testing phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phases = planner.createPhases({ type: 'api', features: [] });
      const testingPhase = phases.find(p => p.phase === 'testing');
      
      expect(testingPhase).toBeDefined();
      expect(testingPhase.priority).toBe(4);
      expect(Array.isArray(testingPhase.tasks)).toBe(true);
    });

    test('should create integration phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phases = planner.createPhases({ type: 'api', features: [] });
      const integrationPhase = phases.find(p => p.phase === 'integration');
      
      expect(integrationPhase).toBeDefined();
      expect(integrationPhase.priority).toBe(5);
      expect(Array.isArray(integrationPhase.tasks)).toBe(true);
    });
  });

  describe('createTask() method', () => {
    test('should create task with required fields', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const task = planner.createTask({
        id: 'task-1',
        action: 'generate_server_code',
        strategy: 'SimpleNodeServer',
        description: 'Generate Express server',
        dependencies: []
      });
      
      expect(task.id).toBe('task-1');
      expect(task.action).toBe('generate_server_code');
      expect(task.strategy).toBe('SimpleNodeServer');
      expect(task.input).toBeDefined();
      expect(task.dependencies).toEqual([]);
    });

    test('should include retry configuration', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const task = planner.createTask({
        id: 'task-1',
        action: 'test_code',
        strategy: 'SimpleNodeTest',
        description: 'Run tests',
        dependencies: []
      });
      
      expect(task.retry).toBeDefined();
      expect(task.retry.maxAttempts).toBeGreaterThan(0);
      expect(task.retry.backoffMs).toBeGreaterThan(0);
      expect(['linear', 'exponential', 'fixed']).toContain(task.retry.strategy);
    });

    test('should include validation criteria', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const task = planner.createTask({
        id: 'task-1',
        action: 'validate_code',
        strategy: 'SimpleNodeDebug',
        description: 'Validate generated code',
        dependencies: []
      });
      
      expect(task.validation).toBeDefined();
      expect(typeof task.validation.required).toBe('boolean');
      expect(Array.isArray(task.validation.criteria)).toBe(true);
    });
  });

  describe('addQualityGates() method', () => {
    test('should add quality gates to phases', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phase = {
        phase: 'testing',
        priority: 4,
        tasks: []
      };
      
      const phaseWithGates = planner.addQualityGates(phase);
      
      expect(phaseWithGates.qualityGates).toBeDefined();
      expect(Array.isArray(phaseWithGates.qualityGates)).toBe(true);
      expect(phaseWithGates.qualityGates.length).toBeGreaterThan(0);
    });

    test('should add test gate to testing phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phase = {
        phase: 'testing',
        priority: 4,
        tasks: []
      };
      
      const phaseWithGates = planner.addQualityGates(phase);
      const testGate = phaseWithGates.qualityGates.find(g => g.type === 'test');
      
      expect(testGate).toBeDefined();
      expect(testGate.blocking).toBe(true);
      expect(testGate.threshold).toBeDefined();
    });

    test('should add security gate to core phase', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const phase = {
        phase: 'core',
        priority: 2,
        tasks: []
      };
      
      const phaseWithGates = planner.addQualityGates(phase);
      const securityGate = phaseWithGates.qualityGates.find(g => g.type === 'security');
      
      expect(securityGate).toBeDefined();
    });
  });

  describe('validatePlan() method', () => {
    test('should validate complete plan', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const plan = {
        planId: 'plan-123',
        projectId: 'project-456',
        version: 1,
        phases: [
          { phase: 'setup', priority: 1, tasks: [] }
        ],
        parallelization: { maxConcurrent: 3, strategy: 'balanced' },
        errorHandling: { 
          strategy: 'fail-fast',
          recovery: { enabled: true, maxReplans: 3 }
        }
      };
      
      const isValid = planner.validatePlan(plan);
      expect(isValid).toBe(true);
    });

    test('should reject plan without phases', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const plan = {
        planId: 'plan-123',
        projectId: 'project-456',
        version: 1,
        phases: [],
        parallelization: { maxConcurrent: 3, strategy: 'balanced' },
        errorHandling: { strategy: 'fail-fast' }
      };
      
      const isValid = planner.validatePlan(plan);
      expect(isValid).toBe(false);
    });

    test('should reject plan without required fields', () => {
      const planner = new ProjectStructurePlanner(llmClient, toolRegistry);
      
      const plan = {
        planId: 'plan-123',
        // Missing projectId
        version: 1,
        phases: []
      };
      
      const isValid = planner.validatePlan(plan);
      expect(isValid).toBe(false);
    });
  });
});