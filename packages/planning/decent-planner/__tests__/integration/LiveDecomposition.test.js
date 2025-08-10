/**
 * Live integration tests for task decomposition with Anthropic Claude
 * 
 * These tests require ANTHROPIC_API_KEY to be set in environment
 * Run with: LIVE_TESTS=true npm test -- LiveDecomposition
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { TaskDecomposer } from '../../src/core/TaskDecomposer.js';
import { ResourceManager } from '@legion/tools';
import { Anthropic } from '@anthropic-ai/sdk';

const runLiveTests = process.env.LIVE_TESTS === 'true' || process.env.RUN_LIVE_TESTS === 'true';

const describeOrSkip = runLiveTests ? describe : describe.skip;

describeOrSkip('Live Task Decomposition with Anthropic Claude', () => {
  let decomposer;
  let resourceManager;
  let anthropic;
  
  beforeAll(async () => {
    // Initialize ResourceManager to get API key
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for live tests');
    }
    
    // Create Anthropic client
    anthropic = new Anthropic({ apiKey });
    
    // Create LLM client wrapper
    const llmClient = {
      generateResponse: async (options) => {
        try {
          const response = await anthropic.messages.create({
            model: options.model || 'claude-3-5-sonnet-20241022',
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.2,
            system: options.system || 'You are a helpful AI assistant specializing in task decomposition and planning.',
            messages: options.messages
          });
          
          return {
            content: response.content[0].text,
            usage: response.usage
          };
        } catch (error) {
          console.error('Anthropic API error:', error.message);
          throw error;
        }
      }
    };
    
    decomposer = new TaskDecomposer({ llmClient });
  });
  
  describe('Web Development Tasks', () => {
    it('should decompose REST API task', async () => {
      const result = await decomposer.decompose(
        'Build a REST API with user authentication and CRUD operations',
        {
          domain: 'web-development',
          maxDepth: 3,
          maxWidth: 5
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.task).toBe('Build a REST API with user authentication and CRUD operations');
      expect(result.subtasks).toBeDefined();
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.subtasks.length).toBeLessThanOrEqual(5);
      
      // Check subtask structure
      result.subtasks.forEach(subtask => {
        expect(subtask.id).toBeDefined();
        expect(subtask.description).toBeDefined();
        expect(subtask.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
        expect(subtask.reasoning).toBeDefined();
        
        // Complex tasks should suggest further decomposition
        if (subtask.complexity === 'COMPLEX') {
          expect(subtask.suggestedSubtasks).toBeDefined();
        }
        
        // Check I/O hints
        if (subtask.suggestedInputs) {
          expect(Array.isArray(subtask.suggestedInputs)).toBe(true);
        }
        if (subtask.suggestedOutputs) {
          expect(Array.isArray(subtask.suggestedOutputs)).toBe(true);
        }
      });
      
      console.log(`Decomposed into ${result.subtasks.length} subtasks:`);
      result.subtasks.forEach(st => {
        console.log(`  - [${st.complexity}] ${st.description}`);
      });
    }, 30000);
    
    it('should decompose frontend application task', async () => {
      const result = await decomposer.decompose(
        'Create a React dashboard with charts and real-time data',
        {
          domain: 'web-development',
          maxDepth: 2,
          maxWidth: 4
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.subtasks).toBeDefined();
      
      // Should include UI and data handling tasks
      const hasUITask = result.subtasks.some(st => 
        st.description.toLowerCase().includes('ui') ||
        st.description.toLowerCase().includes('component') ||
        st.description.toLowerCase().includes('layout')
      );
      
      const hasDataTask = result.subtasks.some(st =>
        st.description.toLowerCase().includes('data') ||
        st.description.toLowerCase().includes('api') ||
        st.description.toLowerCase().includes('websocket')
      );
      
      expect(hasUITask).toBe(true);
      expect(hasDataTask).toBe(true);
    }, 30000);
  });
  
  describe('Data Analysis Tasks', () => {
    it('should decompose data pipeline task', async () => {
      const result = await decomposer.decompose(
        'Analyze CSV data, clean it, and create visualizations',
        {
          domain: 'data-analysis',
          maxDepth: 3,
          maxWidth: 6
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.subtasks).toBeDefined();
      
      // Should include data loading, cleaning, and visualization
      const taskTypes = result.subtasks.map(st => st.description.toLowerCase());
      
      const hasDataLoading = taskTypes.some(desc =>
        desc.includes('load') || desc.includes('read') || desc.includes('import')
      );
      
      const hasDataCleaning = taskTypes.some(desc =>
        desc.includes('clean') || desc.includes('validate') || desc.includes('transform')
      );
      
      const hasVisualization = taskTypes.some(desc =>
        desc.includes('visual') || desc.includes('chart') || desc.includes('plot')
      );
      
      expect(hasDataLoading).toBe(true);
      expect(hasDataCleaning).toBe(true);
      expect(hasVisualization).toBe(true);
    }, 30000);
  });
  
  describe('System Administration Tasks', () => {
    it('should decompose deployment task', async () => {
      const result = await decomposer.decompose(
        'Deploy a Node.js application to AWS with CI/CD pipeline',
        {
          domain: 'devops',
          maxDepth: 3,
          maxWidth: 5
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.subtasks).toBeDefined();
      
      // Should include infrastructure and pipeline tasks
      const hasInfraTask = result.subtasks.some(st =>
        st.description.toLowerCase().includes('infrastructure') ||
        st.description.toLowerCase().includes('aws') ||
        st.description.toLowerCase().includes('server')
      );
      
      const hasCICDTask = result.subtasks.some(st =>
        st.description.toLowerCase().includes('ci') ||
        st.description.toLowerCase().includes('cd') ||
        st.description.toLowerCase().includes('pipeline')
      );
      
      expect(hasInfraTask).toBe(true);
      expect(hasCICDTask).toBe(true);
    }, 30000);
  });
  
  describe('Complexity Classification', () => {
    it('should correctly classify simple tasks', async () => {
      const simpleTasks = [
        'Write a hello world program',
        'Create a single HTML file',
        'Read a JSON file',
        'Calculate the sum of two numbers'
      ];
      
      for (const task of simpleTasks) {
        const result = await decomposer.decompose(task, { maxDepth: 1 });
        
        expect(result.success).toBe(true);
        
        // Simple tasks might not be decomposed further
        if (result.subtasks.length === 0) {
          // Task itself is simple
          expect(result.complexity).toBe('SIMPLE');
        } else {
          // Or decomposed into simple subtasks
          const allSimple = result.subtasks.every(st => st.complexity === 'SIMPLE');
          expect(allSimple).toBe(true);
        }
      }
    }, 60000);
    
    it('should correctly classify complex tasks', async () => {
      const complexTasks = [
        'Build a complete e-commerce platform',
        'Create a machine learning pipeline',
        'Develop a mobile app with backend'
      ];
      
      for (const task of complexTasks) {
        const result = await decomposer.decompose(task, { maxDepth: 2 });
        
        expect(result.success).toBe(true);
        expect(result.subtasks.length).toBeGreaterThan(0);
        
        // Should have at least some complex subtasks
        const hasComplex = result.subtasks.some(st => st.complexity === 'COMPLEX');
        expect(hasComplex).toBe(true);
      }
    }, 60000);
  });
  
  describe('I/O Hint Generation', () => {
    it('should generate meaningful I/O hints', async () => {
      const result = await decomposer.decompose(
        'Process user registration: validate email, hash password, store in database, send confirmation',
        {
          domain: 'web-development',
          maxDepth: 2
        }
      );
      
      expect(result.success).toBe(true);
      
      // Find validation subtask
      const validationTask = result.subtasks.find(st =>
        st.description.toLowerCase().includes('validat') ||
        st.description.toLowerCase().includes('email')
      );
      
      if (validationTask) {
        expect(validationTask.suggestedInputs).toBeDefined();
        expect(validationTask.suggestedOutputs).toBeDefined();
        
        // Should have email as input
        const hasEmailInput = validationTask.suggestedInputs.some(input =>
          input.toLowerCase().includes('email') ||
          input.toLowerCase().includes('user')
        );
        expect(hasEmailInput).toBe(true);
      }
      
      // Find storage subtask
      const storageTask = result.subtasks.find(st =>
        st.description.toLowerCase().includes('store') ||
        st.description.toLowerCase().includes('database')
      );
      
      if (storageTask) {
        expect(storageTask.suggestedInputs).toBeDefined();
        expect(storageTask.suggestedOutputs).toBeDefined();
      }
    }, 30000);
  });
  
  describe('Error Handling', () => {
    it('should handle empty task description', async () => {
      const result = await decomposer.decompose('', { maxDepth: 1 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.subtasks).toEqual([]);
    });
    
    it('should handle very long task descriptions', async () => {
      const longTask = 'Build a system that ' + 'processes data and '.repeat(100) + 'generates reports';
      
      const result = await decomposer.decompose(longTask, { maxDepth: 1, maxWidth: 3 });
      
      // Should still work but respect width limit
      expect(result.success).toBe(true);
      expect(result.subtasks.length).toBeLessThanOrEqual(3);
    }, 30000);
    
    it('should handle special characters in task description', async () => {
      const result = await decomposer.decompose(
        'Create a parser for JSON with special chars: {"key": "value@#$%"}',
        { maxDepth: 2 }
      );
      
      expect(result.success).toBe(true);
      expect(result.subtasks).toBeDefined();
    }, 30000);
  });
  
  describe('Recursive Decomposition', () => {
    it('should maintain context in recursive decomposition', async () => {
      // First level decomposition
      const level1 = await decomposer.decompose(
        'Build a blog platform',
        { maxDepth: 1, maxWidth: 3 }
      );
      
      expect(level1.success).toBe(true);
      
      // Find a complex subtask to decompose further
      const complexTask = level1.subtasks.find(st => st.complexity === 'COMPLEX');
      
      if (complexTask) {
        // Second level decomposition
        const level2 = await decomposer.decompose(
          complexTask.description,
          { 
            maxDepth: 1,
            maxWidth: 3,
            parentContext: {
              task: level1.task,
              siblings: level1.subtasks.map(st => st.description)
            }
          }
        );
        
        expect(level2.success).toBe(true);
        expect(level2.subtasks).toBeDefined();
        
        // Check that I/O hints are coherent with parent level
        if (complexTask.suggestedOutputs && level2.subtasks.length > 0) {
          const lastSubtask = level2.subtasks[level2.subtasks.length - 1];
          if (lastSubtask.suggestedOutputs) {
            // Last subtask outputs should relate to parent outputs
            console.log('Parent outputs:', complexTask.suggestedOutputs);
            console.log('Child final outputs:', lastSubtask.suggestedOutputs);
          }
        }
      }
    }, 45000);
  });
});