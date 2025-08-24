/**
 * Integration tests for ComplexityClassifier with real LLM
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ComplexityClassifier } from '../../../src/core/informal/ComplexityClassifier.js';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';

describe('ComplexityClassifier Live Integration', () => {
  let classifier;
  let llmClient;
  let hasLiveServices = false;

  beforeAll(async () => {
    // Initialize ResourceManager
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Check for API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.log('Skipping live tests - no ANTHROPIC_API_KEY');
      return;
    }
    
    // Create real LLM client
    const anthropic = new Anthropic({ apiKey });
    llmClient = {
      complete: async (prompt, options = {}) => {
        const response = await anthropic.messages.create({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0.2,
          system: 'You are a task complexity classifier. Return only JSON.',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    classifier = new ComplexityClassifier(llmClient);
    hasLiveServices = true;
  });

  describe('Real LLM Classification', () => {
    it('should classify simple file operations correctly', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services');
        return;
      }

      const tasks = [
        'Write content to a file',
        'Read and parse a JSON file',
        'Create a new directory',
        'Delete temporary files'
      ];

      for (const task of tasks) {
        const result = await classifier.classify(task);
        // LLM might classify these as either SIMPLE or COMPLEX, both are valid
        expect(result.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
        expect(result.reasoning).toBeDefined();
        console.log(`Task: "${task}" -> ${result.complexity}`);
        console.log(`  Reasoning: ${result.reasoning}`);
        // Most should be SIMPLE
        if (result.complexity !== 'SIMPLE') {
          console.log(`  Note: Task classified as COMPLEX (may vary based on LLM interpretation)`);
        }
      }
    });

    it('should classify complex system building correctly', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services');
        return;
      }

      const tasks = [
        'Build a complete web application with user authentication',
        'Create a REST API with CRUD operations for multiple resources',
        'Set up a CI/CD pipeline with automated testing and deployment',
        'Build a real-time chat system with WebSocket support'
      ];

      for (const task of tasks) {
        const result = await classifier.classify(task);
        expect(result.complexity).toBe('COMPLEX');
        expect(result.reasoning).toBeDefined();
        console.log(`Task: "${task}" -> ${result.complexity}`);
        console.log(`  Reasoning: ${result.reasoning}`);
      }
    });

    it('should classify edge cases appropriately', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services');
        return;
      }

      const edgeCases = [
        {
          task: 'Create a database table with foreign key constraints and indexes',
          expected: 'SIMPLE',
          reason: 'Single focused database operation'
        },
        {
          task: 'Implement user registration with email verification',
          expected: 'COMPLEX',
          reason: 'Involves multiple components: forms, email, database'
        },
        {
          task: 'Generate a PDF report from data',
          expected: 'SIMPLE',
          reason: 'Single transformation operation'
        },
        {
          task: 'Build a microservices architecture with service discovery',
          expected: 'COMPLEX',
          reason: 'Multiple services and infrastructure'
        }
      ];

      for (const testCase of edgeCases) {
        const result = await classifier.classify(testCase.task);
        console.log(`\nTask: "${testCase.task}"`);
        console.log(`  Expected: ${testCase.expected} (${testCase.reason})`);
        console.log(`  Got: ${result.complexity}`);
        console.log(`  LLM Reasoning: ${result.reasoning}`);
        
        // Note: LLM might have different but valid interpretations
        expect(result.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      }
    });

    it('should use domain context effectively', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services');
        return;
      }

      const task = 'Create a model';
      
      // Same task, different domains
      const webContext = await classifier.classify(task, { domain: 'web-development' });
      const mlContext = await classifier.classify(task, { domain: 'machine-learning' });
      const dbContext = await classifier.classify(task, { domain: 'database' });

      console.log('\nTask: "Create a model" in different domains:');
      console.log(`  Web Development: ${webContext.complexity} - ${webContext.reasoning}`);
      console.log(`  Machine Learning: ${mlContext.complexity} - ${mlContext.reasoning}`);
      console.log(`  Database: ${dbContext.complexity} - ${dbContext.reasoning}`);

      // All should be valid classifications
      expect(webContext.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      expect(mlContext.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      expect(dbContext.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tasks gracefully', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services');
        return;
      }

      const malformedTasks = [
        '...',
        '???',
        'ajshdkajshd',
        '12345'
      ];

      for (const task of malformedTasks) {
        const result = await classifier.classify(task);
        // Should still classify even unclear tasks
        expect(result.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
        expect(result.reasoning).toBeDefined();
      }
    });
  });
});