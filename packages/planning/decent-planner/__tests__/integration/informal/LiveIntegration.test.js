/**
 * LIVE Integration Tests for Informal Planner
 * 
 * Requirements:
 * - ANTHROPIC_API_KEY or OPENAI_API_KEY in .env
 * - Real ToolRegistry with actual tools
 * 
 * NO MOCKS - This uses real LLM and real tools!
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  InformalPlanner,
  ComplexityClassifier,
  TaskDecomposer,
  ToolFeasibilityChecker,
  DecompositionValidator,
  TaskNode
} from '../../../src/core/informal/index.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';

describe('LIVE Informal Planner Integration Tests', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let isLive = false;

  beforeAll(async () => {
    console.log('\n🚀 Starting LIVE integration tests with REAL services...\n');
    
    // Initialize ResourceManager singleton - this loads .env automatically
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Check for API keys
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
    
    if (!anthropicKey && !openaiKey) {
      console.log('❌ No API keys found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
      return;
    }
    
    // Create REAL LLM client
    if (anthropicKey) {
      console.log('✅ Using Anthropic Claude for LLM');
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
    } else if (openaiKey) {
      console.log('✅ Using OpenAI GPT for LLM');
      const openai = new OpenAI({ apiKey: openaiKey });
      
      llmClient = {
        complete: async (prompt) => {
          const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 2000
          });
          return response.choices[0].message.content;
        }
      };
    }
    
    // Get REAL ToolRegistry singleton and initialize
    console.log('✅ Initializing real ToolRegistry...');
    toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Test if tools are available
    try {
      const testSearch = await toolRegistry.searchTools('file', { limit: 5 });
      console.log(`✅ ToolRegistry ready with semantic search (found ${testSearch.length} file tools)`);
    } catch (error) {
      console.log('⚠️  ToolRegistry semantic search not fully configured:', error.message);
    }
    
    isLive = true;
  });

  describe('Phase 2: ComplexityClassifier with Real LLM', () => {
    it('should classify SIMPLE tasks correctly', async () => {
      if (!isLive) {
        console.log('Skipping - no live services');
        return;
      }

      const classifier = new ComplexityClassifier(llmClient);
      
      const simpleTask = 'Write the string "Hello World" to a file named output.txt';
      console.log(`\n📝 Classifying: "${simpleTask}"`);
      
      const result = await classifier.classify(simpleTask);
      
      console.log(`   Result: ${result.complexity}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      
      expect(result.complexity).toBe('SIMPLE');
      expect(result.reasoning).toBeTruthy();
    }, 30000);

    it('should classify COMPLEX tasks correctly', async () => {
      if (!isLive) return;

      const classifier = new ComplexityClassifier(llmClient);
      
      const complexTask = 'Build a complete e-commerce website with user authentication, product catalog, shopping cart, and payment processing';
      console.log(`\n📝 Classifying: "${complexTask}"`);
      
      const result = await classifier.classify(complexTask);
      
      console.log(`   Result: ${result.complexity}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      
      expect(result.complexity).toBe('COMPLEX');
      expect(result.reasoning).toBeTruthy();
    }, 30000);
  });

  describe('Phase 3: TaskDecomposer with Real LLM', () => {
    it('should decompose a complex task into subtasks', async () => {
      if (!isLive) return;

      const classifier = new ComplexityClassifier(llmClient);
      const decomposer = new TaskDecomposer(llmClient, classifier);
      
      const task = 'Create a REST API for managing user accounts';
      console.log(`\n🔨 Decomposing: "${task}"`);
      
      const result = await decomposer.decompose(task);
      
      console.log(`   Original task: ${result.task}`);
      console.log(`   Subtasks generated: ${result.subtasks.length}`);
      
      result.subtasks.forEach((subtask, i) => {
        console.log(`   ${i+1}. ${subtask.description}`);
        if (subtask.suggestedInputs?.length > 0) {
          console.log(`      Inputs: ${subtask.suggestedInputs.join(', ')}`);
        }
        if (subtask.suggestedOutputs?.length > 0) {
          console.log(`      Outputs: ${subtask.suggestedOutputs.join(', ')}`);
        }
      });
      
      expect(result.task).toBeTruthy();
      expect(result.subtasks).toBeDefined();
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.subtasks.length).toBeLessThanOrEqual(10);
      
      // Each subtask should have required fields
      result.subtasks.forEach(subtask => {
        expect(subtask.description).toBeTruthy();
        expect(subtask.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      });
    }, 30000);

    it('should recursively decompose until all tasks are SIMPLE', async () => {
      if (!isLive) return;

      const classifier = new ComplexityClassifier(llmClient);
      const decomposer = new TaskDecomposer(llmClient, classifier);
      
      const task = 'Build a task management application';
      console.log(`\n🔨 Recursively decomposing: "${task}"`);
      
      const hierarchy = await decomposer.decomposeRecursively(task, {}, { maxDepth: 3 });
      
      // Print the hierarchy
      const printHierarchy = (node, indent = '') => {
        console.log(`${indent}${node.complexity === 'SIMPLE' ? '○' : '●'} ${node.description} [${node.complexity}]`);
        if (node.subtasks) {
          node.subtasks.forEach(child => printHierarchy(child, indent + '  '));
        }
      };
      
      printHierarchy(hierarchy);
      
      // Verify all leaves are SIMPLE
      const checkLeaves = (node) => {
        if (!node.subtasks || node.subtasks.length === 0) {
          expect(node.complexity).toBe('SIMPLE');
        } else {
          node.subtasks.forEach(checkLeaves);
        }
      };
      
      checkLeaves(hierarchy);
    }, 60000);
  });

  describe('Phase 4: ToolFeasibilityChecker with Real ToolRegistry', () => {
    it('should discover tools for file operations', async () => {
      if (!isLive) return;

      const checker = new ToolFeasibilityChecker(toolRegistry, {
        confidenceThreshold: 0.5
      });
      
      const task = new TaskNode({
        description: 'Read data from a CSV file and parse it',
        complexity: 'SIMPLE',
        suggestedInputs: ['file path'],
        suggestedOutputs: ['parsed data array']
      });
      
      console.log(`\n🔍 Finding tools for: "${task.description}"`);
      
      const result = await checker.checkTaskFeasibility(task);
      
      console.log(`   Feasible: ${result.feasible}`);
      console.log(`   Tools found: ${result.tools.length}`);
      
      if (result.tools.length > 0) {
        console.log('   Top tools:');
        result.tools.slice(0, 5).forEach(tool => {
          console.log(`     - ${tool.name} (confidence: ${tool.confidence?.toFixed(2) || 'N/A'})`);
        });
      }
      
      expect(result.feasible).toBeDefined();
      expect(result.tools).toBeDefined();
      
      if (result.feasible) {
        expect(result.tools.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should check feasibility for a task hierarchy', async () => {
      if (!isLive) return;

      const checker = new ToolFeasibilityChecker(toolRegistry, {
        confidenceThreshold: 0.5
      });
      
      // Create a small hierarchy
      const root = new TaskNode({
        description: 'Process data files',
        complexity: 'COMPLEX'
      });
      
      const subtask1 = new TaskNode({
        description: 'Read input file',
        complexity: 'SIMPLE'
      });
      
      const subtask2 = new TaskNode({
        description: 'Transform data format',
        complexity: 'SIMPLE'
      });
      
      const subtask3 = new TaskNode({
        description: 'Write output file',
        complexity: 'SIMPLE'
      });
      
      root.addSubtask(subtask1);
      root.addSubtask(subtask2);
      root.addSubtask(subtask3);
      
      console.log('\n🔍 Checking hierarchy feasibility...');
      
      const result = await checker.checkHierarchyFeasibility(root);
      
      console.log(`   Total tasks: ${result.totalTasks}`);
      console.log(`   Simple tasks: ${result.simpleTasks}`);
      console.log(`   Feasible tasks: ${result.feasibleTasks}`);
      console.log(`   Overall feasible: ${result.feasible}`);
      
      if (!result.feasible && result.infeasibleTasks.length > 0) {
        console.log('   Infeasible tasks:');
        result.infeasibleTasks.forEach(task => {
          console.log(`     - ${task.task}: ${task.reason}`);
        });
      }
      
      expect(result.totalTasks).toBe(4);
      expect(result.simpleTasks).toBe(3);
    }, 30000);
  });

  describe('Phase 6: Complete InformalPlanner with Real Services', () => {
    it('should plan a SIMPLE task end-to-end', async () => {
      if (!isLive) return;

      const planner = new InformalPlanner(llmClient, toolRegistry, {
        confidenceThreshold: 0.5
      });
      
      const goal = 'Calculate the sum of numbers from 1 to 100';
      console.log(`\n🎯 Planning SIMPLE task: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      console.log('\n📊 Results:');
      console.log(`   Complexity: ${result.hierarchy.complexity}`);
      console.log(`   Tools found: ${result.hierarchy.tools?.length || 0}`);
      console.log(`   Feasible: ${result.hierarchy.feasible}`);
      console.log(`   Valid: ${result.validation.valid}`);
      
      if (result.hierarchy.tools && result.hierarchy.tools.length > 0) {
        console.log('   Tools:');
        result.hierarchy.tools.slice(0, 3).forEach(tool => {
          console.log(`     - ${tool.name}`);
        });
      }
      
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.complexity).toBe('SIMPLE');
      expect(result.validation.valid).toBe(true);
      
      // Generate report
      const report = planner.generateReport(result);
      console.log('\n📄 Report Preview:');
      console.log(report.split('\n').slice(0, 20).join('\n'));
    }, 30000);

    it('should plan a COMPLEX task with full decomposition', async () => {
      if (!isLive) return;

      const planner = new InformalPlanner(llmClient, toolRegistry, {
        maxDepth: 3,
        confidenceThreshold: 0.5
      });
      
      const goal = 'Build a simple web scraper that extracts article titles from a news website and saves them to a CSV file';
      console.log(`\n🎯 Planning COMPLEX task: "${goal}"`);
      
      const startTime = Date.now();
      const result = await planner.plan(goal);
      const elapsed = Date.now() - startTime;
      
      console.log(`\n⏱️  Planning completed in ${elapsed}ms`);
      console.log('\n📊 Results:');
      console.log(`   Root complexity: ${result.hierarchy.complexity}`);
      console.log(`   Total tasks: ${result.statistics.totalTasks}`);
      console.log(`   Simple tasks: ${result.statistics.simpleTasks}`);
      console.log(`   Complex tasks: ${result.statistics.complexTasks}`);
      console.log(`   Max depth: ${result.statistics.maxDepth}`);
      console.log(`   Feasible tasks: ${result.statistics.feasibleTasks}`);
      console.log(`   Unique tools: ${result.statistics.uniqueToolsCount}`);
      console.log(`   Valid: ${result.validation.valid}`);
      console.log(`   Overall feasible: ${result.validation.feasibility.overallFeasible}`);
      
      // Print the hierarchy
      console.log('\n📋 Task Hierarchy:');
      const printHierarchy = (node, indent = '') => {
        const marker = node.complexity === 'SIMPLE' ? '○' : '●';
        const feasible = node.feasible === true ? '✓' : node.feasible === false ? '✗' : '';
        const tools = node.tools ? ` [${node.tools.length} tools]` : '';
        console.log(`${indent}${marker} ${node.description} ${feasible}${tools}`);
        if (node.subtasks) {
          node.subtasks.forEach(child => printHierarchy(child, indent + '  '));
        }
      };
      printHierarchy(result.hierarchy);
      
      // Validation details
      if (!result.validation.valid) {
        console.log('\n⚠️  Validation Issues:');
        if (result.validation.structure.errors?.length > 0) {
          console.log('  Structure errors:', result.validation.structure.errors);
        }
        if (result.validation.dependencies.errors?.length > 0) {
          console.log('  Dependency errors:', result.validation.dependencies.errors);
        }
        if (result.validation.feasibility.infeasibleTasks?.length > 0) {
          console.log('  Infeasible tasks:', result.validation.feasibility.infeasibleTasks);
        }
      }
      
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.hierarchy.subtasks).toBeDefined();
      expect(result.hierarchy.subtasks.length).toBeGreaterThan(0);
      expect(result.statistics.totalTasks).toBeGreaterThan(1);
      
      // Save the full result for inspection
      console.log('\n💾 Full result structure available in result object');
    }, 120000);

    it('should create a real actionable plan for a practical task', async () => {
      if (!isLive) return;

      const planner = new InformalPlanner(llmClient, toolRegistry, {
        maxDepth: 4,
        confidenceThreshold: 0.5
      });
      
      const goal = 'Create a Node.js script that reads all JavaScript files in a directory, counts the lines of code, and generates a summary report';
      console.log(`\n🎯 Planning PRACTICAL task: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      // Generate full report
      const report = planner.generateReport(result);
      
      console.log('\n' + '='.repeat(80));
      console.log('COMPLETE PLANNING REPORT');
      console.log('='.repeat(80));
      console.log(report);
      console.log('='.repeat(80));
      
      // Verify the plan is actionable
      expect(result.validation.valid).toBe(true);
      expect(result.statistics.simpleTasks).toBeGreaterThan(0);
      
      // Check that we have concrete steps
      const collectSimpleTasks = (node, tasks = []) => {
        if (node.complexity === 'SIMPLE') {
          tasks.push({
            description: node.description,
            tools: node.tools?.map(t => t.name) || [],
            feasible: node.feasible
          });
        }
        if (node.subtasks) {
          node.subtasks.forEach(child => collectSimpleTasks(child, tasks));
        }
        return tasks;
      };
      
      const simpleTasks = collectSimpleTasks(result.hierarchy);
      
      console.log('\n📝 Executable Steps:');
      simpleTasks.forEach((task, i) => {
        console.log(`${i+1}. ${task.description}`);
        if (task.tools.length > 0) {
          console.log(`   Tools: ${task.tools.join(', ')}`);
        }
        console.log(`   Feasible: ${task.feasible ? 'Yes' : 'No'}`);
      });
      
      expect(simpleTasks.length).toBeGreaterThan(0);
    }, 120000);
  });

  afterAll(async () => {
    console.log('\n✅ Live integration tests completed');
  });
});