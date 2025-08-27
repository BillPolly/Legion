/**
 * Integration tests for DecomposeTaskUseCase
 * Simplified with mock components to avoid timeouts
 */

import { DecomposeTaskUseCase } from '../../../src/application/use-cases/DecomposeTaskUseCase.js';
import { Task } from '../../../src/domain/entities/Task.js';
import { InMemoryTaskRepository } from '../../../src/infrastructure/adapters/InMemoryTaskRepository.js';
import { ConsoleLogger } from '../../../src/infrastructure/adapters/ConsoleLogger.js';

// Simple mock classifier that doesn't use LLM
class MockComplexityClassifier {
  async classify(taskDescription) {
    // Simple rule-based classification
    const simpleKeywords = ['write', 'read', 'parse', 'extract', 'hello'];
    const isSimple = simpleKeywords.some(keyword => 
      taskDescription.toLowerCase().includes(keyword)
    );
    
    return {
      complexity: isSimple ? 'SIMPLE' : 'COMPLEX',
      reasoning: isSimple ? 'Task is simple and atomic' : 'Task requires multiple steps'
    };
  }
}

// Simple mock decomposer that doesn't use LLM
class MockTaskDecomposer {
  async decompose(taskDescription) {
    return {
      subtasks: [
        {
          description: 'Step 1: Initialize',
          inputs: [],
          outputs: ['initialized'],
          reasoning: 'Setup phase'
        },
        {
          description: 'Step 2: Execute main logic',
          inputs: ['initialized'],
          outputs: ['result'],
          reasoning: 'Core functionality'
        }
      ]
    };
  }
}

describe('DecomposeTaskUseCase Integration', () => {
  let useCase;
  let taskRepository;
  
  beforeEach(async () => {
    // Create fresh repository for each test to avoid accumulation
    taskRepository = new InMemoryTaskRepository();
    
    useCase = new DecomposeTaskUseCase({
      taskRepository,
      complexityClassifier: new MockComplexityClassifier(),
      taskDecomposer: new MockTaskDecomposer(),
      logger: new ConsoleLogger({ level: 'error' }),
      maxDepth: 1,
      minSubtasks: 2,
      maxSubtasks: 4
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
        description: 'Create a web application'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'web_development' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.task.isComplex()).toBe(true);
      expect(result.data.task.hasSubtasks()).toBe(true);
      expect(result.data.task.getSubtaskCount()).toBe(2);
    });
  });
  
  describe('depth limiting', () => {
    it('should respect maximum depth limit', async () => {
      const task = new Task({
        description: 'Create a task management system'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { domain: 'enterprise' }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.statistics.maxDepth).toBeLessThanOrEqual(1);
    });
  });
  
  describe('progress tracking', () => {
    it('should report progress during decomposition', async () => {
      const task = new Task({
        description: 'Create a simple API'
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
        description: 'Implement user registration'
      });
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(true);
      expect(result.data.validation.valid).toBe(true);
      expect(result.data.validation.errors).toEqual([]);
    });
  });
  
  describe('error handling', () => {
    it('should handle empty task description', async () => {
      const task = new Task({
        description: 'Test task'
      });
      task.description = ''; // Invalid after creation
      
      const result = await useCase.execute({ task });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should handle context properly', async () => {
      const task = new Task({
        description: 'Analyze data'
      });
      
      const result = await useCase.execute({ 
        task,
        context: { 
          domain: 'finance',
          parentTask: 'Build platform'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.task).toBeDefined();
    });
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
    });
  });
});