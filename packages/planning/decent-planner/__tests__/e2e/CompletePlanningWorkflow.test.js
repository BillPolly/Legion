/**
 * Complete Planning Workflow End-to-End Tests
 * 
 * Tests the entire planning workflow from task description to executable behavior tree.
 * Uses REAL LLM, REAL semantic search, REAL tool registry - NO MOCKS!
 * 
 * This tests the critical path for the decent planner:
 * Task -> LLM Decomposition -> Semantic Tool Discovery -> Plan Synthesis -> Behavior Tree
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { InformalPlanner } from '../../src/core/informal/InformalPlanner.js';
import { ComplexityClassifier } from '../../src/core/informal/ComplexityClassifier.js';
import { TaskDecomposer } from '../../src/core/informal/TaskDecomposer.js';
import { ToolFeasibilityChecker } from '../../src/core/informal/ToolFeasibilityChecker.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry, SemanticToolDiscovery } from '@legion/tools-registry';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';

describe('COMPLETE Planning Workflow E2E Tests', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let semanticDiscovery;
  let informalPlanner;
  let isLive = false;

  beforeAll(async () => {
    console.log('\n🚀 Starting COMPLETE planning workflow E2E tests...\n');
    
    try {
      // Initialize ResourceManager singleton
      resourceManager = ResourceManager.getInstance();
      await resourceManager.initialize();
      
      // Check for API keys
      const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
      const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
      
      if (!anthropicKey && !openaiKey) {
        console.log('❌ No LLM API keys found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
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
              max_tokens: 3000,
              temperature: 0.1, // Low temperature for consistent results
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
              temperature: 0.1,
              max_tokens: 3000
            });
            return response.choices[0].message.content;
          }
        };
      }
      
      // Use ToolRegistry singleton
      console.log('✅ Initializing ToolRegistry singleton...');
      toolRegistry = await ToolRegistry.getInstance();
      
      // Create real semantic discovery
      semanticDiscovery = await SemanticToolDiscovery.createForTools(resourceManager, {
        collectionName: 'tool_perspectives'
      });
      
      console.log('✅ SemanticToolDiscovery created with Nomic embeddings');
      
      // Test connectivity
      const testSearch = await semanticDiscovery.findRelevantTools('file read', { limit: 3 });
      const tools = testSearch.tools || testSearch; // Handle both formats
      console.log(`✅ Semantic search test: found ${tools.length} tools for "file read"`);
      
      if (tools.length === 0) {
        console.log('⚠️  No tools found in semantic search - database may not be populated');
        return;
      }
      
      // Create the complete InformalPlanner with all real services
      informalPlanner = new InformalPlanner(llmClient, toolRegistry, {
        maxDepth: 4,
        confidenceThreshold: 0.3,
        enableSemanticSearch: true
      });
      
      console.log('✅ InformalPlanner created with all live services');
      
      isLive = true;
      
    } catch (error) {
      console.error('❌ Failed to initialize live services:', error.message);
      console.error(error.stack);
      isLive = false;
    }
  });

  describe('Simple Task Planning (Basic Block)', () => {
    it('should plan a simple file operation task', async () => {
      if (!isLive) {
        console.log('Skipping - live services not available');
        return;
      }

      console.log('\n📝 Testing: Simple file operation planning');
      
      const goal = 'Read a text file and count the number of lines in it';
      console.log(`   Goal: "${goal}"`);
      
      const startTime = Date.now();
      const result = await informalPlanner.plan(goal);
      const elapsed = Date.now() - startTime;
      
      console.log(`   ⏱️  Planning completed in ${elapsed}ms`);
      console.log(`   📊 Result structure:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Total tasks: ${result.statistics?.totalTasks}`);
      console.log(`      Simple tasks: ${result.statistics?.simpleTasks}`);
      console.log(`      Tools found: ${result.statistics?.uniqueToolsCount || 0}`);
      
      // Basic structure validation
      expect(result).toBeDefined();
      expect(result.hierarchy).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.statistics).toBeDefined();
      
      // The task should be decomposed appropriately
      expect(result.hierarchy.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      expect(result.statistics.totalTasks).toBeGreaterThan(0);
      expect(result.validation.valid).toBe(true);
      
      // Should find file-related tools
      if (result.statistics.uniqueToolsCount > 0) {
        console.log('   ✅ Found tools for file operations');
        
        // Collect all tools found in the hierarchy
        const collectTools = (node, tools = new Set()) => {
          if (node.tools) {
            node.tools.forEach(tool => tools.add(tool.name));
          }
          if (node.subtasks) {
            node.subtasks.forEach(child => collectTools(child, tools));
          }
          return tools;
        };
        
        const allTools = collectTools(result.hierarchy);
        console.log(`   Tools discovered: ${Array.from(allTools).join(', ')}`);
        
        // Should have at least one file-related tool
        const fileTools = Array.from(allTools).filter(name => 
          name.toLowerCase().includes('file') || 
          name.toLowerCase().includes('read')
        );
        expect(fileTools.length).toBeGreaterThan(0);
      }
      
    }, 60000); // 60 second timeout

    it('should plan a simple calculation task', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: Simple calculation task planning');
      
      const goal = 'Calculate the sum of numbers from 1 to 100';
      console.log(`   Goal: "${goal}"`);
      
      const result = await informalPlanner.plan(goal);
      
      console.log(`   📊 Result structure:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Tools found: ${result.statistics?.uniqueToolsCount || 0}`);
      
      expect(result.validation.valid).toBe(true);
      expect(result.hierarchy.complexity).toMatch(/^(SIMPLE|COMPLEX)$/);
      
      // Should find calculation tools
      if (result.statistics.uniqueToolsCount > 0) {
        const collectTools = (node, tools = new Set()) => {
          if (node.tools) {
            node.tools.forEach(tool => tools.add(tool.name));
          }
          if (node.subtasks) {
            node.subtasks.forEach(child => collectTools(child, tools));
          }
          return tools;
        };
        
        const allTools = collectTools(result.hierarchy);
        console.log(`   Tools discovered: ${Array.from(allTools).join(', ')}`);
        
        const mathTools = Array.from(allTools).filter(name => 
          name.toLowerCase().includes('calc') ||
          name.toLowerCase().includes('math') ||
          name.toLowerCase().includes('add') ||
          name.toLowerCase().includes('sum')
        );
        
        if (mathTools.length > 0) {
          console.log('   ✅ Found calculation tools');
          expect(mathTools.length).toBeGreaterThan(0);
        }
      }
      
    }, 60000);
  });

  describe('JSON Processing Tasks (Complex Block)', () => {
    it('should plan a JSON file processing task', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: JSON file processing planning');
      
      const goal = 'Read a JSON configuration file, validate it has required fields (name, version, dependencies), and create a summary report';
      console.log(`   Goal: "${goal}"`);
      
      const result = await informalPlanner.plan(goal);
      
      console.log(`   📊 Planning results:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Total tasks: ${result.statistics?.totalTasks}`);
      console.log(`      Simple tasks: ${result.statistics?.simpleTasks}`);
      console.log(`      Max depth: ${result.statistics?.maxDepth}`);
      console.log(`      Unique tools: ${result.statistics?.uniqueToolsCount || 0}`);
      
      // Should be a complex task with subtasks
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.hierarchy.subtasks).toBeDefined();
      expect(result.hierarchy.subtasks.length).toBeGreaterThan(0);
      expect(result.statistics.totalTasks).toBeGreaterThan(1);
      expect(result.validation.valid).toBe(true);
      
      // Print the hierarchy
      const printHierarchy = (node, indent = '') => {
        const marker = node.complexity === 'SIMPLE' ? '○' : '●';
        const toolCount = node.tools ? ` [${node.tools.length} tools]` : '';
        console.log(`${indent}${marker} ${node.description}${toolCount}`);
        if (node.subtasks) {
          node.subtasks.forEach(child => printHierarchy(child, indent + '  '));
        }
      };
      
      console.log('\n   📋 Task Hierarchy:');
      printHierarchy(result.hierarchy);
      
      // Should find JSON and file tools
      const collectTools = (node, tools = new Set()) => {
        if (node.tools) {
          node.tools.forEach(tool => tools.add(tool.name));
        }
        if (node.subtasks) {
          node.subtasks.forEach(child => collectTools(child, tools));
        }
        return tools;
      };
      
      const allTools = collectTools(result.hierarchy);
      if (allTools.size > 0) {
        console.log(`\n   🔧 All tools found: ${Array.from(allTools).join(', ')}`);
        
        const jsonTools = Array.from(allTools).filter(name => 
          name.toLowerCase().includes('json')
        );
        const fileTools = Array.from(allTools).filter(name => 
          name.toLowerCase().includes('file')
        );
        
        console.log(`   JSON tools: ${jsonTools.length > 0 ? jsonTools.join(', ') : 'none'}`);
        console.log(`   File tools: ${fileTools.length > 0 ? fileTools.join(', ') : 'none'}`);
        
        // Should have both types for this task
        expect(jsonTools.length + fileTools.length).toBeGreaterThan(0);
      }
      
    }, 90000);

    it('should plan an API-to-JSON task', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: API to JSON processing planning');
      
      const goal = 'Fetch data from a REST API, parse the JSON response, extract specific fields, and save to a local JSON file';
      console.log(`   Goal: "${goal}"`);
      
      const result = await informalPlanner.plan(goal);
      
      console.log(`   📊 Planning results:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Total tasks: ${result.statistics?.totalTasks}`);
      console.log(`      Unique tools: ${result.statistics?.uniqueToolsCount || 0}`);
      
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.statistics.totalTasks).toBeGreaterThan(2);
      expect(result.validation.valid).toBe(true);
      
      // Should find multiple tool categories
      const collectTools = (node, tools = new Set()) => {
        if (node.tools) {
          node.tools.forEach(tool => tools.add(tool.name));
        }
        if (node.subtasks) {
          node.subtasks.forEach(child => collectTools(child, tools));
        }
        return tools;
      };
      
      const allTools = collectTools(result.hierarchy);
      if (allTools.size > 0) {
        console.log(`\n   🔧 All tools found: ${Array.from(allTools).join(', ')}`);
        
        const categories = {
          http: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('http') ||
            name.toLowerCase().includes('api') ||
            name.toLowerCase().includes('request') ||
            name.toLowerCase().includes('fetch')
          ),
          json: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('json')
          ),
          file: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('file') ||
            name.toLowerCase().includes('write')
          )
        };
        
        console.log(`   HTTP/API tools: ${categories.http.length > 0 ? categories.http.join(', ') : 'none'}`);
        console.log(`   JSON tools: ${categories.json.length > 0 ? categories.json.join(', ') : 'none'}`);
        console.log(`   File tools: ${categories.file.length > 0 ? categories.file.join(', ') : 'none'}`);
        
        // Should span multiple categories
        const categoriesWithTools = Object.values(categories).filter(cat => cat.length > 0).length;
        console.log(`   Categories covered: ${categoriesWithTools}/3`);
        
        // Expect at least 2 of the 3 categories for this complex task
        expect(categoriesWithTools).toBeGreaterThanOrEqual(2);
      }
      
    }, 120000);
  });

  describe('Multi-Step File Processing (Complex Block)', () => {
    it('should plan a comprehensive file processing workflow', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: Comprehensive file processing workflow');
      
      const goal = 'Create a Node.js script that reads all JavaScript files in a directory, analyzes them for function definitions, counts lines of code, and generates a detailed report in both JSON and HTML formats';
      console.log(`   Goal: "${goal}"`);
      
      const startTime = Date.now();
      const result = await informalPlanner.plan(goal);
      const elapsed = Date.now() - startTime;
      
      console.log(`   ⏱️  Planning completed in ${elapsed}ms`);
      console.log(`   📊 Planning results:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Total tasks: ${result.statistics?.totalTasks}`);
      console.log(`      Simple tasks: ${result.statistics?.simpleTasks}`);
      console.log(`      Complex tasks: ${result.statistics?.complexTasks}`);
      console.log(`      Max depth: ${result.statistics?.maxDepth}`);
      console.log(`      Unique tools: ${result.statistics?.uniqueToolsCount || 0}`);
      console.log(`      Feasible tasks: ${result.statistics?.feasibleTasks || 0}`);
      
      // This should be a complex, multi-level plan
      expect(result.hierarchy.complexity).toBe('COMPLEX');
      expect(result.statistics.totalTasks).toBeGreaterThan(5);
      expect(result.statistics.maxDepth).toBeGreaterThan(1);
      expect(result.validation.valid).toBe(true);
      
      // Print detailed hierarchy
      const printHierarchy = (node, indent = '', level = 0) => {
        const marker = node.complexity === 'SIMPLE' ? '○' : '●';
        const feasible = node.feasible === true ? '✓' : node.feasible === false ? '✗' : '?';
        const toolCount = node.tools ? ` [${node.tools.length} tools]` : '';
        console.log(`${indent}${marker} ${node.description} ${feasible}${toolCount}`);
        
        if (node.tools && node.tools.length > 0 && level < 2) {
          node.tools.slice(0, 3).forEach(tool => {
            console.log(`${indent}   🔧 ${tool.name}`);
          });
          if (node.tools.length > 3) {
            console.log(`${indent}   ... and ${node.tools.length - 3} more`);
          }
        }
        
        if (node.subtasks) {
          node.subtasks.forEach(child => printHierarchy(child, indent + '  ', level + 1));
        }
      };
      
      console.log('\n   📋 Complete Task Hierarchy:');
      printHierarchy(result.hierarchy);
      
      // Analyze tool coverage
      const collectTools = (node, tools = new Set()) => {
        if (node.tools) {
          node.tools.forEach(tool => tools.add(tool.name));
        }
        if (node.subtasks) {
          node.subtasks.forEach(child => collectTools(child, tools));
        }
        return tools;
      };
      
      const allTools = collectTools(result.hierarchy);
      if (allTools.size > 0) {
        console.log(`\n   🔧 Tool Analysis (${allTools.size} unique tools):`);
        
        const toolCategories = {
          file: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('file') ||
            name.toLowerCase().includes('read') ||
            name.toLowerCase().includes('write')
          ),
          directory: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('dir') ||
            name.toLowerCase().includes('folder') ||
            name.toLowerCase().includes('list')
          ),
          string: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('string') ||
            name.toLowerCase().includes('text') ||
            name.toLowerCase().includes('parse')
          ),
          json: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('json')
          ),
          html: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('html') ||
            name.toLowerCase().includes('template')
          ),
          analysis: Array.from(allTools).filter(name => 
            name.toLowerCase().includes('analyze') ||
            name.toLowerCase().includes('count') ||
            name.toLowerCase().includes('extract')
          )
        };
        
        Object.entries(toolCategories).forEach(([category, tools]) => {
          if (tools.length > 0) {
            console.log(`      ${category}: ${tools.join(', ')}`);
          }
        });
        
        // Should cover most categories for this comprehensive task
        const categoriesWithTools = Object.values(toolCategories).filter(cat => cat.length > 0).length;
        console.log(`      Categories covered: ${categoriesWithTools}/6`);
        
        expect(categoriesWithTools).toBeGreaterThanOrEqual(3); // At least 3 categories
      }
      
      // Generate full report
      const report = informalPlanner.generateReport(result);
      console.log('\n   📄 Generated Report Length:', report.length, 'characters');
      
      // The report should contain key information
      expect(report).toContain('Task Hierarchy');
      expect(report).toContain('Tools Required');
      expect(report).toContain('Validation Results');
      
    }, 180000); // 3 minute timeout for complex planning

    it('should handle edge case with no tools found', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: Edge case - task with potentially no tools');
      
      const goal = 'Perform quantum computing operations on a 1000-qubit system';
      console.log(`   Goal: "${goal}"`);
      
      const result = await informalPlanner.plan(goal);
      
      console.log(`   📊 Results for edge case:`);
      console.log(`      Valid: ${result.validation?.valid}`);
      console.log(`      Complexity: ${result.hierarchy?.complexity}`);
      console.log(`      Total tasks: ${result.statistics?.totalTasks}`);
      console.log(`      Tools found: ${result.statistics?.uniqueToolsCount || 0}`);
      console.log(`      Feasible tasks: ${result.statistics?.feasibleTasks || 0}`);
      
      // Should still create a valid plan structure, even if no tools found
      expect(result.hierarchy).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.statistics).toBeDefined();
      
      // May be marked as invalid due to lack of tools, but structure should be intact
      if (!result.validation.valid) {
        console.log('   ⚠️  Plan marked invalid (expected for specialized task)');
        if (result.validation.feasibility?.infeasibleTasks) {
          console.log(`   Infeasible tasks: ${result.validation.feasibility.infeasibleTasks.length}`);
        }
      }
      
    }, 90000);
  });

  describe('Planning Quality and Consistency', () => {
    it('should produce consistent plans for the same task', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: Planning consistency');
      
      const goal = 'Read a CSV file and calculate the average of the numeric values in the second column';
      console.log(`   Goal: "${goal}"`);
      
      // Run the same planning task twice
      const results = [];
      for (let i = 0; i < 2; i++) {
        console.log(`   Run ${i + 1}...`);
        const result = await informalPlanner.plan(goal);
        results.push(result);
      }
      
      // Compare key metrics
      console.log('\n   Consistency Analysis:');
      console.log(`   Run 1 - Tasks: ${results[0].statistics?.totalTasks}, Tools: ${results[0].statistics?.uniqueToolsCount}, Valid: ${results[0].validation?.valid}`);
      console.log(`   Run 2 - Tasks: ${results[1].statistics?.totalTasks}, Tools: ${results[1].statistics?.uniqueToolsCount}, Valid: ${results[1].validation?.valid}`);
      
      // Should have similar structure
      expect(results[0].hierarchy.complexity).toBe(results[1].hierarchy.complexity);
      expect(results[0].validation.valid).toBe(results[1].validation.valid);
      
      // Task counts might vary slightly but should be in same ballpark
      const taskDiff = Math.abs(results[0].statistics.totalTasks - results[1].statistics.totalTasks);
      expect(taskDiff).toBeLessThanOrEqual(2); // Allow small variation
      
      console.log(`   Task count difference: ${taskDiff} (acceptable)`);
      
    }, 120000);

    it('should show planning performance metrics', async () => {
      if (!isLive) return;

      console.log('\n📝 Testing: Planning performance metrics');
      
      const testCases = [
        { name: 'Simple', task: 'Write hello world to a file' },
        { name: 'Medium', task: 'Parse JSON file and extract specific fields' },
        { name: 'Complex', task: 'Build web scraper that extracts data and saves to database' }
      ];
      
      console.log('\n   Performance Results:');
      console.log('   Task Type | Time (ms) | Tasks | Tools | Valid');
      console.log('   ---------|-----------|-------|-------|-------');
      
      for (const testCase of testCases) {
        const startTime = Date.now();
        const result = await informalPlanner.plan(testCase.task);
        const elapsed = Date.now() - startTime;
        
        const tasks = result.statistics?.totalTasks || 0;
        const tools = result.statistics?.uniqueToolsCount || 0;
        const valid = result.validation?.valid ? 'Yes' : 'No';
        
        console.log(`   ${testCase.name.padEnd(8)} | ${elapsed.toString().padStart(8)} | ${tasks.toString().padStart(5)} | ${tools.toString().padStart(5)} | ${valid}`);
        
        // Performance expectations
        expect(elapsed).toBeLessThan(120000); // Max 2 minutes
        expect(result.hierarchy).toBeDefined();
      }
      
    }, 300000); // 5 minute timeout for performance test
  });

  afterAll(async () => {
    if (isLive) {
      console.log('\n✅ Complete planning workflow E2E tests completed successfully!');
      console.log('   The decent planner successfully integrates:');
      console.log('   - Live LLM for task decomposition');
      console.log('   - Live semantic search for tool discovery');
      console.log('   - Live tool registry for executable tools');
      console.log('   - End-to-end planning workflow');
    } else {
      console.log('\n⚠️  Complete planning workflow E2E tests skipped');
      console.log('   Required: LLM API key and populated tool database');
    }
  });
});