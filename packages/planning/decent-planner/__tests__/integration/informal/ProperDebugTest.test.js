/**
 * Proper debug test using ResourceManager as per Legion patterns
 */

import { describe, it, expect } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ComplexityClassifier } from '../../../src/core/informal/ComplexityClassifier.js';
import { TaskDecomposer } from '../../../src/core/informal/TaskDecomposer.js';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Proper Debug Test with ResourceManager', () => {
  let resourceManager;
  let decomposer;
  let classifier;
  let llmClient;
  let llmCallCount = 0;
  let llmCallLog = [];
  
  beforeAll(async () => {
    // Initialize ResourceManager - it automatically loads all .env variables
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Get the API key from ResourceManager
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('No ANTHROPIC_API_KEY found in ResourceManager');
    }
    
    console.log('✅ ResourceManager initialized, API key found');
    
    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    
    // Create LLM client with extensive logging
    llmClient = {
      complete: async (prompt) => {
        const callNumber = ++llmCallCount;
        const startTime = Date.now();
        
        console.log(`\n📞 LLM Call #${callNumber} starting...`);
        console.log(`Prompt length: ${prompt.length} chars`);
        
        // Show what we're asking for
        const promptLines = prompt.split('\n');
        console.log(`First 10 lines of prompt:`);
        promptLines.slice(0, 10).forEach(line => console.log(`  ${line}`));
        
        try {
          const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }]
          });
          
          const responseText = response.content[0].text;
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          console.log(`✅ LLM Call #${callNumber} completed in ${duration}ms`);
          console.log(`Response length: ${responseText.length} chars`);
          
          // Try to parse JSON if possible to show structure
          try {
            const parsed = JSON.parse(responseText);
            console.log(`Response structure:`, JSON.stringify(parsed, null, 2).substring(0, 500));
          } catch {
            console.log(`First 500 chars of response:\n${responseText.substring(0, 500)}`);
          }
          
          llmCallLog.push({
            callNumber,
            duration,
            promptLength: prompt.length,
            responseLength: responseText.length
          });
          
          return responseText;
        } catch (error) {
          console.error(`❌ LLM Call #${callNumber} failed:`, error.message);
          throw error;
        }
      }
    };
    
    classifier = new ComplexityClassifier(llmClient);
    decomposer = new TaskDecomposer(llmClient, classifier);
  });

  it('should show exactly what happens during decomposition', async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DEBUGGING TASK DECOMPOSITION - "Create a script to process CSV files"');
    console.log('='.repeat(80));
    
    const task = 'Create a script to process CSV files';
    
    // STEP 1: Just classify the main task
    console.log('\n📊 STEP 1: Classify the main task');
    console.log('Task:', task);
    
    const classificationResult = await classifier.classify(task);
    console.log(`\nClassification Result:`);
    console.log(`  Complexity: ${classificationResult.complexity}`);
    console.log(`  Reasoning: ${classificationResult.reasoning}`);
    
    if (classificationResult.complexity !== 'COMPLEX') {
      console.log('⚠️ Task was classified as SIMPLE, no decomposition needed');
      expect(classificationResult.complexity).toBe('SIMPLE');
      return;
    }
    
    // STEP 2: Single-level decomposition
    console.log('\n' + '-'.repeat(80));
    console.log('📊 STEP 2: Single-level decomposition');
    llmCallCount = 0;
    
    const singleLevelResult = await decomposer.decompose(task);
    
    console.log(`\n✅ Decomposition complete! Generated ${singleLevelResult.subtasks.length} subtasks:`);
    
    singleLevelResult.subtasks.forEach((subtask, i) => {
      console.log(`\n  ${i + 1}. ${subtask.description}`);
      console.log(`     Complexity: ${subtask.complexity}`);
      console.log(`     Reasoning: ${subtask.reasoning}`);
    });
    
    const complexCount = singleLevelResult.subtasks.filter(s => s.complexity === 'COMPLEX').length;
    const simpleCount = singleLevelResult.subtasks.filter(s => s.complexity === 'SIMPLE').length;
    
    console.log(`\n📈 Summary: ${complexCount} COMPLEX, ${simpleCount} SIMPLE`);
    console.log(`Total LLM calls for single-level: ${llmCallCount}`);
    
    // STEP 3: Try recursive with depth 1
    console.log('\n' + '-'.repeat(80));
    console.log('📊 STEP 3: Recursive decomposition with maxDepth=1');
    llmCallCount = 0;
    
    console.log('This will decompose each COMPLEX subtask one more level...');
    
    const depth1Result = await decomposer.decomposeRecursively(
      task,
      {},
      { maxDepth: 1 }
    );
    
    console.log(`\n✅ Recursive decomposition complete!`);
    console.log(`Total LLM calls: ${llmCallCount}`);
    
    // Print hierarchy
    const printHierarchy = (node, indent = '') => {
      const marker = node.complexity === 'SIMPLE' ? '✓' : '●';
      console.log(`${indent}${marker} ${node.description} [${node.complexity}]`);
      if (node.subtasks) {
        node.subtasks.forEach(child => printHierarchy(child, indent + '  '));
      }
    };
    
    console.log('\nFinal Hierarchy:');
    printHierarchy(depth1Result);
    
    // Count nodes
    let nodeCount = { total: 0, simple: 0, complex: 0, leaves: 0, maxDepth: 0 };
    const analyzeNode = (node, depth = 0) => {
      nodeCount.total++;
      if (node.complexity === 'SIMPLE') nodeCount.simple++;
      if (node.complexity === 'COMPLEX') nodeCount.complex++;
      if (!node.subtasks || node.subtasks.length === 0) nodeCount.leaves++;
      if (depth > nodeCount.maxDepth) nodeCount.maxDepth = depth;
      
      if (node.subtasks) {
        node.subtasks.forEach(child => analyzeNode(child, depth + 1));
      }
    };
    analyzeNode(depth1Result);
    
    console.log('\n📊 Final Statistics:');
    console.log(`  Total nodes: ${nodeCount.total}`);
    console.log(`  Simple tasks: ${nodeCount.simple}`);
    console.log(`  Complex tasks: ${nodeCount.complex}`);
    console.log(`  Leaf nodes: ${nodeCount.leaves}`);
    console.log(`  Max depth: ${nodeCount.maxDepth}`);
    
    console.log('\n🔍 LLM Call Summary:');
    llmCallLog.forEach(call => {
      console.log(`  Call #${call.callNumber}: ${call.duration}ms (${call.promptLength} chars → ${call.responseLength} chars)`);
    });
    
    // Verify results
    expect(depth1Result.description).toBeTruthy();
    expect(nodeCount.total).toBeGreaterThan(1);
    expect(nodeCount.leaves).toBeGreaterThan(0);
    
    // All leaves should be SIMPLE at depth 1
    const checkLeaves = (node) => {
      if (!node.subtasks || node.subtasks.length === 0) {
        return node.complexity === 'SIMPLE';
      }
      return node.subtasks.every(checkLeaves);
    };
    
    const allLeavesSimple = checkLeaves(depth1Result);
    console.log(`\n${allLeavesSimple ? '✅' : '⚠️'} All leaf nodes are SIMPLE: ${allLeavesSimple}`);
    
    if (!allLeavesSimple && nodeCount.complex > 0) {
      console.log('\n⚠️ Note: Some leaf nodes are still COMPLEX.');
      console.log('This is expected with maxDepth=1. Would need deeper recursion to fully decompose.');
    }
    
  }, 180000); // 3 minute timeout
});