/**
 * Test the actual ComplexityClassifier with real LLM
 */

import { describe, it, expect } from '@jest/globals';
import { ComplexityClassifier } from '../../../src/core/informal/ComplexityClassifier.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Real ComplexityClassifier Test', () => {
  let classifier;
  
  beforeAll(async () => {
    // Load .env file
    const envPath = path.join(__dirname, '../../../../../.env');
    dotenv.config({ path: envPath });
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('No ANTHROPIC_API_KEY found');
    }
    
    // Create LLM client that our classifier expects
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    
    const llmClient = {
      complete: async (prompt) => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    classifier = new ComplexityClassifier(llmClient);
  });

  it('should classify simple tasks', async () => {
    console.log('\n🎯 Testing ComplexityClassifier with SIMPLE tasks...\n');
    
    const simpleTasks = [
      'Write "Hello World" to a file',
      'Calculate the sum of numbers from 1 to 100',
      'Parse a JSON file and extract a field',
      'Send an HTTP GET request to an API'
    ];
    
    for (const task of simpleTasks) {
      console.log(`\nClassifying: "${task}"`);
      const result = await classifier.classify(task);
      console.log(`  Result: ${result.complexity}`);
      console.log(`  Reasoning: ${result.reasoning}`);
      
      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toBeTruthy();
    }
  }, 60000);

  it('should classify complex tasks', async () => {
    console.log('\n🎯 Testing ComplexityClassifier with COMPLEX tasks...\n');
    
    const complexTasks = [
      'Build a REST API with authentication',
      'Create a full-stack web application',
      'Implement a data processing pipeline with multiple stages',
      'Build a machine learning model training system'
    ];
    
    for (const task of complexTasks) {
      console.log(`\nClassifying: "${task}"`);
      const result = await classifier.classify(task);
      console.log(`  Result: ${result.complexity}`);
      console.log(`  Reasoning: ${result.reasoning}`);
      
      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toBeTruthy();
    }
  }, 60000);

  it('should use context in classification', async () => {
    console.log('\n🎯 Testing ComplexityClassifier with context...\n');
    
    const task = 'Set up the database';
    const context = {
      domain: 'web-development',
      parentTask: 'Build a REST API'
    };
    
    console.log(`Task: "${task}"`);
    console.log('Context:', context);
    
    const result = await classifier.classify(task, context);
    console.log(`Result: ${result.complexity}`);
    console.log(`Reasoning: ${result.reasoning}`);
    
    expect(result.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
    expect(result.reasoning).toBeTruthy();
  }, 30000);
});