/**
 * Integration tests for DecomposeTaskUseCase
 * Using REAL components - no mocks
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { DecomposeTaskUseCase } from '../../../src/application/use-cases/DecomposeTaskUseCase.js';
import { Task } from '../../../src/domain/entities/Task.js';
import { LLMComplexityClassifier } from '../../../src/infrastructure/adapters/LLMComplexityClassifier.js';
import { LLMTaskDecomposer } from '../../../src/infrastructure/adapters/LLMTaskDecomposer.js';
import { InMemoryTaskRepository } from '../../../src/infrastructure/adapters/InMemoryTaskRepository.js';
import { ConsoleLogger } from '../../../src/infrastructure/adapters/ConsoleLogger.js';
import { ResourceManager } from '@legion/resource-manager';

describe('DecomposeTaskUseCase Integration', () => {
  let useCase;
  let taskRepository;
  let llmClient;
  let resourceManager;
  
  beforeAll(async () => {
    // Initialize singleton in beforeAll
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client required for integration tests');
    }
    
    // Create use case with REAL components
    taskRepository = new InMemoryTaskRepository();
    
    useCase = new DecomposeTaskUseCase({
      taskRepository,
      complexityClassifier: new LLMComplexityClassifier(llmClient),
      taskDecomposer: new LLMTaskDecomposer(llmClient),
      logger: new ConsoleLogger({ level: 'error' }), // Reduce noise
      maxDepth: 3,
      minSubtasks: 2,
      maxSubtasks: 8
    });
  });
  
  describe('simple task decomposition', () => {
    it('should classify and not decompose a simple task', async () => {
      const task = new Task({
        description: 'Write "Hello World" to a file'
      });
      
      const result = await useCase.execute({ 
        task, 
        context: { domain: 'file_operations' } 
      });
      
      expect(result.success).toBe(true);
      expect(result.data.task.isSimple()).toBe(true);
      expect(result.data.task.hasSubtasks()).toBe(false);
      expect(result.data.statistics.totalTasks).toBe(1);
      expect(result.data.statistics.simpleTasks).toBe(1);
      expect(result.data.statistics.complexTasks).toBe(0);
    });
    
    it('should provide reasoning for simple classification', async () => {
      const task = new Task({
        description: 'Parse a JSON string and extract a field'
      });
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(true);
      expect(result.data.task.reasoning).toBeDefined();
      expect(typeof result.data.task.reasoning).toBe('string');
    });
  });
  
  describe('complex task decomposition', () => {
    it('should decompose a complex task into subtasks', async () => {
      const task = new Task({
        description: 'Build a REST API with user authentication'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'web_development' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.task.isComplex()).toBe(true);
      expect(result.data.task.hasSubtasks()).toBe(true);
      expect(result.data.task.getSubtaskCount()).toBeGreaterThanOrEqual(2);
      expect(result.data.task.getSubtaskCount()).toBeLessThanOrEqual(8);
    }, 30000);
    
    it('should recursively decompose nested complex tasks', async () => {
      const task = new Task({
        description: 'Create a complete e-commerce website'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'e-commerce' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.statistics.totalTasks).toBeGreaterThan(1);
      expect(result.data.statistics.maxDepth).toBeGreaterThanOrEqual(1);
      expect(result.data.statistics.simpleTasks).toBeGreaterThan(0);
    }, 30000);
  });
  
  describe('depth limiting', () => {
    it('should respect maximum depth limit', async () => {
      const task = new Task({
        description: 'Build an entire software company infrastructure'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'enterprise' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.statistics.maxDepth).toBeLessThanOrEqual(3);
    });
  });
  
  describe('progress tracking', () => {
    it('should report progress during decomposition', async () => {
      const task = new Task({
        description: 'Set up a microservices architecture'
      });
      
      const progressUpdates = [];
      const progressCallback = (message) => {
        progressUpdates.push(message);
      };
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'architecture' },
        progressCallback
      });
      
      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.some(msg => msg.includes('Analyzing'))).toBe(true);
    });
  });
  
  describe('persistence', () => {
    it('should save all tasks in hierarchy to repository', async () => {
      const task = new Task({
        description: 'Create a task management application'
      });
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(true);
      
      // Verify root task was saved
      const savedRoot = await taskRepository.findById(task.id);
      expect(savedRoot).toBeDefined();
      
      // Verify repository contains all tasks
      const repoSize = taskRepository.size();
      expect(repoSize).toBe(result.data.statistics.totalTasks);
    });
  });
  
  describe('validation', () => {
    it('should validate hierarchy structure', async () => {
      const task = new Task({
        description: 'Implement user registration with email verification'
      });
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(true);
      expect(result.data.validation.valid).toBe(true);
      expect(result.data.validation.errors).toEqual([]);
    }, 30000);
  });
  
  describe('error handling', () => {
    it('should handle empty task description', async () => {
      const task = new Task({
        description: 'Test task' // Valid task to create
      });
      task.description = ''; // Invalid after creation
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should handle context properly', async () => {
      const task = new Task({
        description: 'Analyze financial data'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { 
          domain: 'finance',
          parentTask: 'Build trading platform'
        }
      });
      
      expect(result.success).toBe(true);
      // Context should influence decomposition
      expect(result.data.task).toBeDefined();
    }, 30000);
  });
  
  describe('inputs and outputs', () => {
    it('should preserve input and output hints through decomposition', async () => {
      const task = new Task({
        description: 'Process CSV file and generate report',
        inputs: ['csv_file', 'report_template'],
        outputs: ['report_pdf', 'summary_json']
      });
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(true);
      expect(result.data.task.inputs).toEqual(['csv_file', 'report_template']);
      expect(result.data.task.outputs).toEqual(['report_pdf', 'summary_json']);
    }, 30000);
  });
});