/**
 * Complete live integration test for DecentPlanner
 * 
 * This test validates the full planning flow with:
 * - Real LLM (Anthropic Claude)
 * - Real Tool Registry from MongoDB
 * - Real semantic search
 * - No mocks or fallbacks
 * 
 * Requirements:
 * - ANTHROPIC_API_KEY environment variable
 * - MongoDB running with populated tool registry
 * - Set RUN_LIVE_TESTS=true to run
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DecentPlanner } from '../../src/core/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';
import { Anthropic } from '@anthropic-ai/sdk';

const runLiveTests = process.env.RUN_LIVE_TESTS === 'true';
const describeOrSkip = runLiveTests ? describe : describe.skip;

describeOrSkip('Complete Live Planning Integration', () => {
  let planner;
  let resourceManager;
  let toolRegistryProvider;
  let toolRegistry;
  
  beforeAll(async () => {
    console.log('🚀 Initializing live integration test environment...');
    
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Verify API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for live tests');
    }
    
    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey });
    
    // Create LLM client wrapper
    const llmClient = {
      generateResponse: async (options) => {
        const response = await anthropic.messages.create({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.2,
          system: options.system,
          messages: options.messages
        });
        
        return {
          content: response.content[0].text,
          usage: response.usage
        };
      }
    };
    
    // Register LLM client
    resourceManager.register('llmClient', llmClient);
    
    // Initialize MongoDB Tool Registry Provider
    console.log('📚 Connecting to MongoDB tool registry...');
    toolRegistryProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: true
    });
    
    // Verify tools are available
    const toolCount = await toolRegistryProvider.getStats();
    console.log(`✅ Connected to tool registry with ${toolCount.tools} tools`);
    
    if (toolCount.tools === 0) {
      throw new Error('No tools in registry - run npm run db:populate first');
    }
    
    // Register provider
    resourceManager.register('toolRegistryProvider', toolRegistryProvider);
    
    // Initialize Tool Registry
    toolRegistry = new ToolRegistry({ 
      provider: toolRegistryProvider,
      resourceManager 
    });
    await toolRegistry.initialize();
    resourceManager.register('toolRegistry', toolRegistry);
    
    // Create planner
    planner = await DecentPlanner.create(resourceManager);
    console.log('✅ DecentPlanner initialized with all dependencies');
  });
  
  afterAll(async () => {
    if (toolRegistryProvider) {
      await toolRegistryProvider.disconnect();
    }
  });
  
  describe('Simple Task Planning', () => {
    it('should plan a simple file operation task', async () => {
      const goal = 'Read a JSON file, parse it, and extract specific fields';
      
      console.log('\n📋 Planning:', goal);
      const result = await planner.plan(goal, {
        maxDepth: 2,
        debug: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.hierarchy).toBeDefined();
      expect(result.data.behaviorTrees).toBeDefined();
      
      // Should be simple enough to not need decomposition
      const rootTask = result.data.hierarchy;
      expect(rootTask.complexity).toBe('SIMPLE');
      
      // Should have discovered relevant tools
      expect(result.data.discoveredTools).toBeDefined();
      const toolNames = result.data.discoveredTools.map(t => t.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('json_parse');
      
      // Should have generated a behavior tree
      const bt = result.data.behaviorTrees[rootTask.id];
      expect(bt).toBeDefined();
      expect(bt.type).toBeDefined();
      expect(bt.children || bt.tool).toBeDefined();
      
      console.log('✅ Simple task planned successfully');
      console.log('  Discovered tools:', toolNames.join(', '));
      console.log('  Behavior tree type:', bt.type);
    }, 30000);
    
    it('should plan a task with error handling', async () => {
      const goal = 'Try to read a file, handle errors gracefully, and return a default value if it fails';
      
      console.log('\n📋 Planning:', goal);
      const result = await planner.plan(goal, {
        maxDepth: 2,
        debug: true
      });
      
      expect(result.success).toBe(true);
      
      // Should generate a behavior tree with error handling
      const rootTask = result.data.hierarchy;
      const bt = result.data.behaviorTrees[rootTask.id];
      
      // Should include selector or try-catch pattern
      expect(['selector', 'sequence']).toContain(bt.type);
      
      // Should have fallback behavior
      if (bt.children) {
        const hasRetry = JSON.stringify(bt).includes('retry');
        const hasSelector = bt.type === 'selector';
        const hasCondition = JSON.stringify(bt).includes('condition');
        
        expect(hasRetry || hasSelector || hasCondition).toBe(true);
      }
      
      console.log('✅ Error handling task planned successfully');
    }, 30000);
  });
  
  describe('Complex Task Decomposition', () => {
    it('should decompose and plan a multi-step web development task', async () => {
      const goal = 'Create a REST API with user authentication, database models, and CRUD operations';
      
      console.log('\n📋 Planning complex task:', goal);
      const result = await planner.plan(goal, {
        maxDepth: 3,
        maxWidth: 5,
        debug: true
      });
      
      expect(result.success).toBe(true);
      
      // Root should be complex and decomposed
      const rootTask = result.data.hierarchy;
      expect(rootTask.complexity).toBe('COMPLEX');
      expect(rootTask.subtasks).toBeDefined();
      expect(rootTask.subtasks.length).toBeGreaterThan(0);
      expect(rootTask.subtasks.length).toBeLessThanOrEqual(5);
      
      console.log(`  Decomposed into ${rootTask.subtasks.length} subtasks`);
      
      // Each subtask should have appropriate complexity
      rootTask.subtasks.forEach(subtask => {
        expect(subtask.id).toBeDefined();
        expect(subtask.description).toBeDefined();
        expect(subtask.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
        
        console.log(`    - ${subtask.description} [${subtask.complexity}]`);
        
        if (subtask.complexity === 'SIMPLE') {
          // Simple tasks should have behavior trees
          const bt = result.data.behaviorTrees[subtask.id];
          expect(bt).toBeDefined();
          
          // Should have discovered tools for simple tasks
          const tools = result.data.toolsPerTask?.[subtask.id];
          if (tools) {
            console.log(`      Tools: ${tools.map(t => t.name).join(', ')}`);
          }
        } else {
          // Complex tasks should have further subtasks
          expect(subtask.subtasks).toBeDefined();
          expect(subtask.subtasks.length).toBeGreaterThan(0);
        }
      });
      
      // Should have artifacts defined
      expect(result.data.artifacts).toBeDefined();
      
      // Should have execution plan
      expect(result.data.executionPlan).toBeDefined();
      expect(result.data.executionPlan.length).toBeGreaterThan(0);
      
      console.log('✅ Complex task decomposed and planned successfully');
      console.log(`  Total execution steps: ${result.data.executionPlan.length}`);
    }, 60000);
    
    it('should handle context flow between decomposed tasks', async () => {
      const goal = 'Read data from a file, process it, and save the results to a new file';
      
      console.log('\n📋 Planning task with context flow:', goal);
      const result = await planner.plan(goal, {
        maxDepth: 3,
        debug: true
      });
      
      expect(result.success).toBe(true);
      
      // Check that subtasks have I/O hints
      const checkIOHints = (task) => {
        if (task.subtasks) {
          task.subtasks.forEach(subtask => {
            // Should have I/O hints
            if (subtask.complexity === 'SIMPLE') {
              expect(subtask.suggestedInputs || subtask.suggestedOutputs).toBeDefined();
              
              if (subtask.suggestedOutputs) {
                console.log(`    ${subtask.description} outputs: ${subtask.suggestedOutputs.join(', ')}`);
              }
            }
            
            // Recurse for complex tasks
            if (subtask.subtasks) {
              checkIOHints(subtask);
            }
          });
        }
      };
      
      checkIOHints(result.data.hierarchy);
      
      // Check artifact flow in behavior trees
      const behaviorTrees = Object.values(result.data.behaviorTrees);
      const hasArtifactReferences = behaviorTrees.some(bt => 
        JSON.stringify(bt).includes('outputVariable') ||
        JSON.stringify(bt).includes('context.artifacts')
      );
      
      expect(hasArtifactReferences).toBe(true);
      
      console.log('✅ Context flow validated in plan');
    }, 45000);
  });
  
  describe('Tool Discovery Integration', () => {
    it('should discover appropriate tools for different task types', async () => {
      const testCases = [
        {
          goal: 'Parse and validate JSON data',
          expectedTools: ['json_parse', 'json_validate']
        },
        {
          goal: 'Create and write to a file',
          expectedTools: ['file_write', 'directory_create']
        },
        {
          goal: 'Make calculations and process numbers',
          expectedTools: ['calculator']
        }
      ];
      
      for (const testCase of testCases) {
        console.log(`\n🔍 Testing tool discovery for: ${testCase.goal}`);
        
        const result = await planner.plan(testCase.goal, {
          maxDepth: 1,
          debug: false
        });
        
        expect(result.success).toBe(true);
        
        // Get all discovered tools
        const allTools = new Set();
        if (result.data.discoveredTools) {
          result.data.discoveredTools.forEach(t => allTools.add(t.name));
        }
        
        // Check for tool discovery per task
        if (result.data.toolsPerTask) {
          Object.values(result.data.toolsPerTask).forEach(tools => {
            tools.forEach(t => allTools.add(t.name));
          });
        }
        
        console.log('  Discovered tools:', Array.from(allTools).join(', '));
        
        // Verify expected tools were found
        testCase.expectedTools.forEach(expectedTool => {
          expect(allTools.has(expectedTool)).toBe(true);
        });
        
        console.log('  ✅ Expected tools found');
      }
    }, 60000);
  });
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid or unclear goals gracefully', async () => {
      const goal = 'Do something with the thing';
      
      console.log('\n🔍 Testing unclear goal handling:', goal);
      const result = await planner.plan(goal, {
        maxDepth: 2
      });
      
      // Should still return a result
      expect(result).toBeDefined();
      
      if (result.success) {
        // Should attempt decomposition
        expect(result.data.hierarchy).toBeDefined();
      } else {
        // Should provide error information
        expect(result.error).toBeDefined();
        expect(result.error).toContain('unclear');
      }
      
      console.log('✅ Handled unclear goal appropriately');
    }, 30000);
    
    it('should respect depth and width limits', async () => {
      const goal = 'Build a complete e-commerce platform with all features';
      
      console.log('\n🔍 Testing decomposition limits');
      const result = await planner.plan(goal, {
        maxDepth: 2,
        maxWidth: 3
      });
      
      expect(result.success).toBe(true);
      
      // Check depth limit
      const checkDepth = (task, depth = 0) => {
        expect(depth).toBeLessThanOrEqual(2);
        if (task.subtasks) {
          expect(task.subtasks.length).toBeLessThanOrEqual(3);
          task.subtasks.forEach(st => checkDepth(st, depth + 1));
        }
      };
      
      checkDepth(result.data.hierarchy);
      console.log('✅ Decomposition limits respected');
    }, 45000);
  });
  
  describe('Bottom-up Synthesis', () => {
    it('should use bottom-up synthesis for plan generation', async () => {
      const goal = 'Set up a project with npm, create directories, and add configuration files';
      
      console.log('\n🔍 Testing bottom-up synthesis');
      const result = await planner.plan(goal, {
        useBottomUp: true,
        maxDepth: 2
      });
      
      expect(result.success).toBe(true);
      
      // Should have synthesis metadata
      if (result.data.synthesisInfo) {
        expect(result.data.synthesisInfo.approach).toBe('bottom-up');
        expect(result.data.synthesisInfo.levelsProcessed).toBeGreaterThan(0);
      }
      
      // Should have composed behavior trees
      expect(result.data.behaviorTrees).toBeDefined();
      expect(Object.keys(result.data.behaviorTrees).length).toBeGreaterThan(0);
      
      console.log('✅ Bottom-up synthesis completed successfully');
    }, 45000);
  });
});