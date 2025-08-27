/**
 * Unit tests for Domain Error hierarchy
 * Pure error tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import {
  DomainError,
  ValidationError,
  TaskError,
  ComplexityError,
  DecompositionError,
  FeasibilityError,
  PlanError,
  InvalidStateTransitionError,
  HierarchyError,
  ToolDiscoveryError,
  BehaviorTreeError
} from '../../../../src/domain/errors/DomainError.js';

describe('Domain Error Hierarchy', () => {
  describe('DomainError', () => {
    it('should create base domain error', () => {
      const error = new DomainError('Test error', 'TEST_CODE', { extra: 'data' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('DomainError');
    });
    
    it('should have default code', () => {
      const error = new DomainError('Test error');
      expect(error.code).toBe('DOMAIN_ERROR');
    });
    
    it('should serialize to JSON', () => {
      const error = new DomainError('Test error', 'CODE', { field: 'value' });
      const json = error.toJSON();
      
      expect(json.name).toBe('DomainError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('CODE');
      expect(json.details).toEqual({ field: 'value' });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });
  
  describe('ValidationError', () => {
    it('should create validation error with field info', () => {
      const error = new ValidationError('Invalid field', 'email', 'not-an-email');
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('email');
      expect(error.details.value).toBe('not-an-email');
    });
    
    it('should work without field info', () => {
      const error = new ValidationError('General validation error');
      
      expect(error.message).toBe('General validation error');
      expect(error.details.field).toBeNull();
      expect(error.details.value).toBeNull();
    });
  });
  
  describe('TaskError', () => {
    it('should create task error with task details', () => {
      const error = new TaskError('Task failed', 'task-123', 'Build app');
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(TaskError);
      expect(error.code).toBe('TASK_ERROR');
      expect(error.details.taskId).toBe('task-123');
      expect(error.details.taskDescription).toBe('Build app');
    });
  });
  
  describe('ComplexityError', () => {
    it('should create complexity error', () => {
      const error = new ComplexityError('Invalid complexity', 'task-456', 'UNKNOWN');
      
      expect(error).toBeInstanceOf(TaskError);
      expect(error).toBeInstanceOf(ComplexityError);
      expect(error.code).toBe('COMPLEXITY_ERROR');
      expect(error.details.taskId).toBe('task-456');
      expect(error.details.complexity).toBe('UNKNOWN');
    });
  });
  
  describe('DecompositionError', () => {
    it('should create decomposition error with depth', () => {
      const error = new DecompositionError('Max depth exceeded', 'task-789', 10);
      
      expect(error).toBeInstanceOf(TaskError);
      expect(error).toBeInstanceOf(DecompositionError);
      expect(error.code).toBe('DECOMPOSITION_ERROR');
      expect(error.details.depth).toBe(10);
    });
  });
  
  describe('FeasibilityError', () => {
    it('should create feasibility error with reason', () => {
      const error = new FeasibilityError('Task not feasible', 'task-999', 'No tools available');
      
      expect(error).toBeInstanceOf(TaskError);
      expect(error).toBeInstanceOf(FeasibilityError);
      expect(error.code).toBe('FEASIBILITY_ERROR');
      expect(error.details.reason).toBe('No tools available');
    });
  });
  
  describe('PlanError', () => {
    it('should create plan error', () => {
      const error = new PlanError('Plan validation failed', 'plan-111', 'DRAFT');
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(PlanError);
      expect(error.code).toBe('PLAN_ERROR');
      expect(error.details.planId).toBe('plan-111');
      expect(error.details.status).toBe('DRAFT');
    });
  });
  
  describe('InvalidStateTransitionError', () => {
    it('should create state transition error', () => {
      const error = new InvalidStateTransitionError('DRAFT', 'EXECUTING', 'plan-222');
      
      expect(error).toBeInstanceOf(PlanError);
      expect(error).toBeInstanceOf(InvalidStateTransitionError);
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.message).toBe('Invalid state transition from DRAFT to EXECUTING');
      expect(error.details.fromStatus).toBe('DRAFT');
      expect(error.details.toStatus).toBe('EXECUTING');
      expect(error.details.planId).toBe('plan-222');
    });
  });
  
  describe('HierarchyError', () => {
    it('should create hierarchy error with errors and warnings', () => {
      const errors = ['Missing subtasks', 'Invalid depth'];
      const warnings = ['Too many subtasks'];
      const error = new HierarchyError('Invalid hierarchy', errors, warnings);
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(HierarchyError);
      expect(error.code).toBe('HIERARCHY_ERROR');
      expect(error.details.errors).toEqual(errors);
      expect(error.details.warnings).toEqual(warnings);
    });
  });
  
  describe('ToolDiscoveryError', () => {
    it('should create tool discovery error', () => {
      const error = new ToolDiscoveryError('No tools found', 'Create database', 0);
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(ToolDiscoveryError);
      expect(error.code).toBe('TOOL_DISCOVERY_ERROR');
      expect(error.details.taskDescription).toBe('Create database');
      expect(error.details.toolsFound).toBe(0);
    });
  });
  
  describe('BehaviorTreeError', () => {
    it('should create behavior tree error', () => {
      const validationErrors = ['Invalid node type', 'Missing child'];
      const error = new BehaviorTreeError('BT validation failed', 'bt-333', validationErrors);
      
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(BehaviorTreeError);
      expect(error.code).toBe('BEHAVIOR_TREE_ERROR');
      expect(error.details.treeId).toBe('bt-333');
      expect(error.details.validationErrors).toEqual(validationErrors);
    });
  });
  
  describe('error inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const complexityError = new ComplexityError('Test');
      
      expect(complexityError instanceof Error).toBe(true);
      expect(complexityError instanceof DomainError).toBe(true);
      expect(complexityError instanceof TaskError).toBe(true);
      expect(complexityError instanceof ComplexityError).toBe(true);
      expect(complexityError instanceof PlanError).toBe(false);
    });
  });
  
  describe('stack traces', () => {
    it('should capture stack trace', () => {
      const error = new DomainError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DomainError');
      expect(error.stack).toContain('Test error');
    });
  });
});