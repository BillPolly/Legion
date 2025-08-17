/**
 * Test the actual TaskDecomposer with real LLM
 */

import { describe, it, expect } from '@jest/globals';
import { ComplexityClassifier } from '../../../src/core/informal/ComplexityClassifier.js';
import { TaskDecomposer } from '../../../src/core/informal/TaskDecomposer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Real TaskDecomposer Test', () => {
  let decomposer;
  let classifier;
  let llmClient;
  
  beforeAll(async () => {
    // Load .env file
    const envPath = path.join(__dirname, '../../../../../.env');
    dotenv.config({ path: envPath });
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('No ANTHROPIC_API_KEY found');
    }
    
    // Create LLM client
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    
    llmClient = {
      complete: async (prompt) => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    classifier = new ComplexityClassifier(llmClient);
    decomposer = new TaskDecomposer(llmClient, classifier);
  });

  it('should decompose a complex task', async () => {
    console.log('\n🔨 Testing TaskDecomposer.decompose()...\n');
    
    const task = 'Create a Node.js REST API for a todo list application';
    console.log(`Task: "${task}"`);
    
    const result = await decomposer.decompose(task);
    
    console.log('\nDecomposition Result:');
    console.log(`Original: ${result.task}`);
    console.log(`Subtasks: ${result.subtasks.length}`);
    
    result.subtasks.forEach((subtask, i) => {
      console.log(`\n${i + 1}. ${subtask.description} [${subtask.complexity}]`);
      if (subtask.suggestedInputs?.length > 0) {
        console.log(`   Inputs: ${subtask.suggestedInputs.join(', ')}`);
      }
      if (subtask.suggestedOutputs?.length > 0) {
        console.log(`   Outputs: ${subtask.suggestedOutputs.join(', ')}`);
      }
      if (subtask.reasoning) {
        console.log(`   Reasoning: ${subtask.reasoning}`);
      }
    });
    
    expect(result.task).toBeTruthy();
    expect(result.subtasks).toBeDefined();
    expect(result.subtasks.length).toBeGreaterThan(1);
    
    // Each subtask should have been classified
    result.subtasks.forEach(subtask => {
      expect(subtask.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      expect(subtask.description).toBeTruthy();
    });
  }, 30000);

  it('should recursively decompose until all tasks are SIMPLE', async () => {
    console.log('\n🔨 Testing TaskDecomposer.decomposeRecursively()...\n');
    
    const task = 'Create a script to process CSV files';
    console.log(`Task: "${task}"`);
    
    const hierarchy = await decomposer.decomposeRecursively(
      task, 
      {}, 
      { maxDepth: 2 }  // Reduced depth
    );
    
    console.log('\nHierarchy:');
    const printNode = (node, indent = '') => {
      const marker = node.complexity === 'SIMPLE' ? '○' : '●';
      console.log(`${indent}${marker} ${node.description} [${node.complexity}]`);
      if (node.subtasks) {
        node.subtasks.forEach(child => printNode(child, indent + '  '));
      }
    };
    printNode(hierarchy);
    
    // Count statistics
    let totalTasks = 0;
    let simpleTasks = 0;
    let complexTasks = 0;
    let maxDepth = 0;
    
    const countTasks = (node, depth = 0) => {
      totalTasks++;
      if (node.complexity === 'SIMPLE') simpleTasks++;
      if (node.complexity === 'COMPLEX') complexTasks++;
      if (depth > maxDepth) maxDepth = depth;
      
      if (node.subtasks) {
        node.subtasks.forEach(child => countTasks(child, depth + 1));
      }
    };
    countTasks(hierarchy);
    
    console.log('\nStatistics:');
    console.log(`  Total tasks: ${totalTasks}`);
    console.log(`  Simple tasks: ${simpleTasks}`);
    console.log(`  Complex tasks: ${complexTasks}`);
    console.log(`  Max depth: ${maxDepth}`);
    
    // Verify all leaves are SIMPLE
    const verifyLeaves = (node) => {
      if (!node.subtasks || node.subtasks.length === 0) {
        expect(node.complexity).toBe('SIMPLE');
      } else {
        node.subtasks.forEach(verifyLeaves);
      }
    };
    verifyLeaves(hierarchy);
    
    expect(hierarchy.description).toBeTruthy();
    expect(totalTasks).toBeGreaterThan(1);
    expect(simpleTasks).toBeGreaterThan(0);
  }, 120000);  // 2 minute timeout
});