/**
 * End-to-End Workflow Tests
 * Tests complete planning agent workflows using tool modules
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PlanningAgent } from '../../../src/core/agents/base/PlanningAgent.js';
import { AgentConfig } from '../../../src/core/agents/base/AgentConfig.js';
import { TemplatePlanningStrategy } from '../../../src/core/execution/planning/strategies/PlanningStrategy.js';
import { PlanStep } from '../../../src/foundation/types/interfaces/interfaces.js';
import { IdGenerator } from '../../../src/foundation/utils/generators/IdGenerator.js';
import { ConfigurationManager } from '../../src/integration/ConfigurationManager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Enhanced PlanningAgent with registry integration
class E2EPlanningAgent extends PlanningAgent {
  constructor(config, planningStrategy, registry) {
    super(config, planningStrategy);
    this.registry = registry;
  }

  async _executeStep(step, tools, state) {
    const [moduleName, toolName] = step.tool.split('.');
    
    if (!moduleName || !toolName) {
      throw new Error(`Invalid tool name format: ${step.tool}. Expected 'module.tool'`);
    }

    const tool = await this.registry.getTool(step.tool);
    if (!tool) {
      throw new Error(`Tool not found: ${step.tool}`);
    }

    try {
      const result = await tool.execute(step.params);
      return result.success ? result.data : result;
    } catch (error) {
      throw error;
    }
  }

  async _generateInitialPlan(state, tools, context, span) {
    if (span) {
      span.addEvent('planning.start');
    }

    if (!this.planningStrategy) {
      throw new Error('No planning strategy configured');
    }

    try {
      const metadata = await this.registry.getAllMetadata();
      const registryTools = await this.registry.listTools();
      
      const enhancedContext = {
        ...context,
        toolMetadata: metadata,
        availableTools: registryTools
      };

      state.plan = await this.planningStrategy.generatePlan(state.goal, [], enhancedContext);
      
      if (!state.plan || state.plan.length === 0) {
        throw new Error('Planning strategy returned empty plan');
      }

      if (this.config.debugMode) {
        console.log(`[${this.config.name}] Generated plan with ${state.plan.length} steps`);
      }

      if (span) {
        span.addEvent('planning.complete', { stepCount: state.plan.length });
      }

    } catch (error) {
      if (span) {
        span.recordException(error);
      }
      throw new Error(`Plan generation failed: ${error.message}`);
    }
  }
}

// Registry-compatible template planning strategy
class E2ETemplatePlanningStrategy extends TemplatePlanningStrategy {
  async generatePlan(goal, tools, context) {
    const availableTools = context.availableTools || tools.map(t => t.name);
    const toolNames = new Set(availableTools);
    
    let matchedTemplate = null;
    for (const [pattern, template] of Object.entries(this.templates)) {
      if (this.matchesPattern(goal, pattern)) {
        matchedTemplate = template;
        break;
      }
    }
    
    if (!matchedTemplate) {
      throw new Error(`No template found for goal: ${goal}`);
    }
    
    const plan = matchedTemplate.map((templateStep, index) => {
      if (!toolNames.has(templateStep.tool)) {
        throw new Error(`Required tool not available: ${templateStep.tool}`);
      }
      
      return new PlanStep(
        templateStep.id || IdGenerator.generateStepId(`template_${index}`),
        templateStep.description,
        templateStep.tool,
        templateStep.params || {},
        templateStep.dependencies || []
      );
    });
    
    return plan;
  }
}

describe('End-to-End Workflow Tests', () => {
  let testDir;
  let configManager;
  let registry;
  let mockLLM;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-test-'));
    configManager = new ConfigurationManager();
    
    mockLLM = {
      complete: jest.fn().mockResolvedValue('{"type": "proceed", "reasoning": "continue"}')
    };
  });

  afterEach(async () => {
    if (registry) {
      await registry.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('File Processing Workflows', () => {
    test('should execute complete file processing workflow', async () => {
      // Create configuration
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true,
            maxFileSize: 1024 * 1024
          }
        },
        registry: {
          lazy: false
        }
      };

      // Create registry from config
      registry = await configManager.createRegistry(config);

      // Create input files
      await fs.writeFile(path.join(testDir, 'input1.txt'), 'Hello World');
      await fs.writeFile(path.join(testDir, 'input2.txt'), 'Testing Tools');

      // Define workflow
      const workflow = new E2ETemplatePlanningStrategy({
        'file_processing': [
          { 
            id: 'read1', 
            tool: 'filesystem.readFile', 
            params: { path: 'input1.txt' }, 
            description: 'Read first file' 
          },
          { 
            id: 'read2', 
            tool: 'filesystem.readFile', 
            params: { path: 'input2.txt' }, 
            description: 'Read second file' 
          },
          { 
            id: 'combine', 
            tool: 'filesystem.writeFile', 
            params: { path: 'combined.txt', content: 'Combined content' }, 
            description: 'Combine files',
            dependencies: ['read1', 'read2']
          },
          { 
            id: 'verify', 
            tool: 'filesystem.exists', 
            params: { path: 'combined.txt' }, 
            description: 'Verify output file',
            dependencies: ['combine']
          }
        ]
      });

      // Create and execute agent
      const agentConfig = new AgentConfig({
        name: 'FileProcessingAgent',
        debugMode: false,
        maxRetries: 2
      });

      const agent = new E2EPlanningAgent(agentConfig, workflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('file_processing');

      // Verify workflow execution
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(4);
      expect(result.result.totalSteps).toBe(4);

      // Verify output file was created
      const outputPath = path.join(testDir, 'combined.txt');
      const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);

      // Verify execution time is reasonable
      expect(result.result.executionTime).toBeLessThan(5000); // Under 5 seconds
    });

    test('should handle file processing workflow with errors', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Don't create input file to trigger error
      const errorWorkflow = new E2ETemplatePlanningStrategy({
        'error_workflow': [
          { 
            id: 'read_missing', 
            tool: 'filesystem.readFile', 
            params: { path: 'missing.txt' }, 
            description: 'Read missing file' 
          }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'ErrorTestAgent',
        debugMode: false,
        maxRetries: 1
      });

      const agent = new E2EPlanningAgent(agentConfig, errorWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('error_workflow');

      // Should complete but with error result from tool
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(1);
      expect(result.result.executionTime).toBeLessThan(2000);
    });
  });

  describe('Multi-Module Workflows', () => {
    test('should execute workflow using multiple modules', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          },
          http: {
            baseURL: 'https://httpbin.org',
            timeout: 5000
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create test data file
      await fs.writeFile(path.join(testDir, 'data.json'), JSON.stringify({ test: 'data' }));

      const multiModuleWorkflow = new E2ETemplatePlanningStrategy({
        'data_sync': [
          { 
            id: 'read_data', 
            tool: 'filesystem.readFile', 
            params: { path: 'data.json' }, 
            description: 'Read local data' 
          },
          { 
            id: 'post_data', 
            tool: 'http.post', 
            params: { 
              url: '/post',
              data: { source: 'file' },
              headers: { 'Content-Type': 'application/json' }
            }, 
            description: 'Post data to API',
            dependencies: ['read_data']
          },
          { 
            id: 'save_response', 
            tool: 'filesystem.writeFile', 
            params: { path: 'response.json', content: 'API response' }, 
            description: 'Save API response',
            dependencies: ['post_data']
          }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'MultiModuleAgent',
        debugMode: false,
        reflectionEnabled: true
      });

      const agent = new E2EPlanningAgent(agentConfig, multiModuleWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('data_sync');

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(3);
      
      // Verify both modules were used
      const stats = await registry.getUsageStats();
      expect(stats['filesystem.readFile']).toBeDefined();
      expect(stats['http.post']).toBeDefined();
      expect(stats['filesystem.writeFile']).toBeDefined();
    });

    test('should handle handle passing between modules', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          },
          git: {
            repoPath: testDir
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Initialize git repo
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repository');

      const gitWorkflow = new E2ETemplatePlanningStrategy({
        'git_workflow': [
          { 
            id: 'init', 
            tool: 'git.init', 
            params: {}, 
            description: 'Initialize repository' 
          },
          { 
            id: 'add', 
            tool: 'git.add', 
            params: { files: ['README.md'] }, 
            description: 'Add files',
            dependencies: ['init']
          },
          { 
            id: 'commit', 
            tool: 'git.commit', 
            params: { message: 'Initial commit' }, 
            description: 'Commit changes',
            dependencies: ['add']
          },
          { 
            id: 'status', 
            tool: 'git.status', 
            params: {}, 
            description: 'Check status',
            dependencies: ['commit']
          }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'GitWorkflowAgent',
        debugMode: false
      });

      const agent = new E2EPlanningAgent(agentConfig, gitWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('git_workflow');

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(4);
      
      // Verify git operations were executed
      const stats = await registry.getUsageStats();
      expect(stats['git.init']).toBeDefined();
      expect(stats['git.add']).toBeDefined();
      expect(stats['git.commit']).toBeDefined();
      expect(stats['git.status']).toBeDefined();
    });
  });

  describe('Complex Dependency Workflows', () => {
    test('should execute workflow with complex dependencies', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create input files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'Content 1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'Content 2');
      await fs.writeFile(path.join(testDir, 'file3.txt'), 'Content 3');

      const complexWorkflow = new E2ETemplatePlanningStrategy({
        'complex_dependencies': [
          // Parallel reads
          { id: 'read1', tool: 'filesystem.readFile', params: { path: 'file1.txt' }, description: 'Read file 1' },
          { id: 'read2', tool: 'filesystem.readFile', params: { path: 'file2.txt' }, description: 'Read file 2' },
          { id: 'read3', tool: 'filesystem.readFile', params: { path: 'file3.txt' }, description: 'Read file 3' },
          
          // Combine first two
          { 
            id: 'combine12', 
            tool: 'filesystem.writeFile', 
            params: { path: 'combined12.txt', content: 'Combined 1+2' }, 
            description: 'Combine files 1&2',
            dependencies: ['read1', 'read2']
          },
          
          // Final combination
          { 
            id: 'final', 
            tool: 'filesystem.writeFile', 
            params: { path: 'final.txt', content: 'Final result' }, 
            description: 'Final combination',
            dependencies: ['combine12', 'read3']
          },
          
          // Verification
          { 
            id: 'verify_all', 
            tool: 'filesystem.exists', 
            params: { path: 'final.txt' }, 
            description: 'Verify final result',
            dependencies: ['final']
          }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'ComplexDependencyAgent',
        debugMode: false
      });

      const agent = new E2EPlanningAgent(agentConfig, complexWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('complex_dependencies');

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(6);
      
      // Verify all files were created
      const combined12Exists = await fs.access(path.join(testDir, 'combined12.txt')).then(() => true).catch(() => false);
      const finalExists = await fs.access(path.join(testDir, 'final.txt')).then(() => true).catch(() => false);
      
      expect(combined12Exists).toBe(true);
      expect(finalExists).toBe(true);
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('should handle error propagation in dependency chain', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create only one input file, leave others missing
      await fs.writeFile(path.join(testDir, 'good.txt'), 'Good content');

      const errorPropagationWorkflow = new E2ETemplatePlanningStrategy({
        'error_propagation': [
          { id: 'read_good', tool: 'filesystem.readFile', params: { path: 'good.txt' }, description: 'Read good file' },
          { id: 'read_bad', tool: 'filesystem.readFile', params: { path: 'missing.txt' }, description: 'Read missing file' },
          { 
            id: 'combine', 
            tool: 'filesystem.writeFile', 
            params: { path: 'result.txt', content: 'Combined' }, 
            description: 'Combine results',
            dependencies: ['read_good', 'read_bad']
          }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'ErrorPropagationAgent',
        debugMode: false,
        maxRetries: 1
      });

      const agent = new E2EPlanningAgent(agentConfig, errorPropagationWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('error_propagation');

      // Should still complete successfully (tools handle errors gracefully)
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(3);
      
      // Verify partial execution
      const resultExists = await fs.access(path.join(testDir, 'result.txt')).then(() => true).catch(() => false);
      expect(resultExists).toBe(true);
    });

    test('should handle retry mechanisms in workflows', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          }
        }
      };

      registry = await configManager.createRegistry(config);

      const retryWorkflow = new E2ETemplatePlanningStrategy({
        'retry_test': [
          { id: 'flaky_read', tool: 'filesystem.readFile', params: { path: 'test.txt' }, description: 'Flaky read operation' }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'RetryAgent',
        debugMode: false,
        maxRetries: 3
      });

      // Mock a flaky tool that succeeds on retry
      const originalGetTool = registry.getTool.bind(registry);
      let callCount = 0;
      
      registry.getTool = jest.fn(async (toolName) => {
        const tool = await originalGetTool(toolName);
        if (toolName === 'filesystem.readFile') {
          const originalExecute = tool.execute.bind(tool);
          tool.execute = jest.fn(async (input) => {
            callCount++;
            if (callCount <= 2) {
              // Create file on third attempt
              if (callCount === 3) {
                await fs.writeFile(path.join(testDir, 'test.txt'), 'Success!');
              }
              throw new Error('Simulated failure');
            }
            return await originalExecute(input);
          });
        }
        return tool;
      });

      const agent = new E2EPlanningAgent(agentConfig, retryWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      // Create the file before the third attempt would read it
      await fs.writeFile(path.join(testDir, 'test.txt'), 'Success!');

      const result = await agent.run('retry_test');

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(1);
    });
  });

  describe('Resource Management', () => {
    test('should manage resources across workflow execution', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true,
            maxFileSize: 1024 * 1024 // 1MB limit
          }
        }
      };

      registry = await configManager.createRegistry(config);

      // Create files of various sizes
      await fs.writeFile(path.join(testDir, 'small.txt'), 'Small content');
      await fs.writeFile(path.join(testDir, 'medium.txt'), 'Medium content'.repeat(100));

      const resourceWorkflow = new E2ETemplatePlanningStrategy({
        'resource_test': [
          { id: 'read_small', tool: 'filesystem.readFile', params: { path: 'small.txt' }, description: 'Read small file' },
          { id: 'read_medium', tool: 'filesystem.readFile', params: { path: 'medium.txt' }, description: 'Read medium file' },
          { id: 'write_output', tool: 'filesystem.writeFile', params: { path: 'output.txt', content: 'Processed' }, description: 'Write output' }
        ]
      });

      const agentConfig = new AgentConfig({
        name: 'ResourceAgent',
        debugMode: false
      });

      const agent = new E2EPlanningAgent(agentConfig, resourceWorkflow, registry);
      agent.setDependencies({ llm: mockLLM });

      const result = await agent.run('resource_test');

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBe(3);
      
      // Verify resource usage tracking
      expect(result.metrics).toBeDefined();
      expect(result.metrics.toolCalls).toBe(3);
      
      // Verify memory artifacts
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.size).toBeGreaterThan(0);
    });
  });
});