/**
 * Integration test for real tool execution through BehaviorTree system
 * NO MOCKS - Uses real ToolRegistry singleton and actual tools
 */

import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { createAgentToolNodeConfig } from '../../src/bt/AgentBTConfig.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('Real Tool Execution Integration Tests', () => {
  let resourceManager;
  let toolRegistry;
  let agent;
  
  beforeAll(async () => {
    // Get real singletons - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    // Register toolRegistry with ResourceManager
    resourceManager.set('toolRegistry', toolRegistry);
    
    // Verify we have real tools available
    const tools = await toolRegistry.listTools();
    console.log(`ToolRegistry has ${tools.length} real tools available`);
  });
  
  beforeEach(async () => {
    // Create agent with calculator capability - use actual tool names from registry
    const agentConfig = {
      agent: {
        id: 'test-agent',
        name: 'TestAgent',
        type: 'task',
        version: '1.0.0',
        capabilities: [
          {
            module: 'mock-calculator-module',
            tools: ['add', 'multiply'],
            permissions: { read: true, write: true, execute: true }
          }
        ],
        llm: {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          temperature: 0.1,
          maxTokens: 100,
          systemPrompt: 'You are a test assistant.'
        },
        state: {
          maxHistorySize: 10,
          contextVariables: {}
        }
      }
    };
    
    agent = new ConfigurableAgent(agentConfig, resourceManager);
    await agent.initialize();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.receive({ type: 'shutdown', from: 'test' });
    }
  });
  
  describe('Calculator Tool Execution', () => {
    test('should execute real add tool through BehaviorTree', async () => {
      // Create BT config for add operation using actual tool name
      const btConfig = createAgentToolNodeConfig({
        id: 'calc-test',
        name: 'Add Test',
        tool: 'add',
        operation: 'execute',
        params: { a: 10, b: 5 },
        outputVariable: 'calcResult'
      });
      
      // Execute through agent
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'test',
        sessionId: 'test-session',
        btConfig: btConfig
      });
      
      // Verify execution succeeded
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.calcResult).toBeDefined();
      expect(result.artifacts.calcResult.result).toBe(15);
    });
    
    test('should handle multiple calculator operations in sequence', async () => {
      // Test addition
      const addConfig = createAgentToolNodeConfig({
        id: 'add-test',
        name: 'Addition Test',
        tool: 'add',
        operation: 'execute',
        params: { a: 20, b: 30 },
        outputVariable: 'addResult'
      });
      
      const addResult = await agent.receive({
        type: 'execute_bt',
        from: 'test',
        sessionId: 'test-session-1',
        btConfig: addConfig
      });
      
      expect(addResult.success).toBe(true);
      expect(addResult.artifacts.addResult.result).toBe(50);
      
      // Test multiplication
      const multiplyConfig = createAgentToolNodeConfig({
        id: 'multiply-test',
        name: 'Multiplication Test',
        tool: 'multiply',
        operation: 'execute',
        params: { a: 7, b: 8 },
        outputVariable: 'multiplyResult'
      });
      
      const multiplyResult = await agent.receive({
        type: 'execute_bt',
        from: 'test',
        sessionId: 'test-session-2',
        btConfig: multiplyConfig
      });
      
      expect(multiplyResult.success).toBe(true);
      expect(multiplyResult.artifacts.multiplyResult.result).toBe(56);
    });
    
    test('should handle invalid tool errors gracefully', async () => {
      // Test with non-existent tool
      const invalidConfig = createAgentToolNodeConfig({
        id: 'invalid-test',
        name: 'Invalid Tool Test',
        tool: 'nonexistent_tool',
        operation: 'execute',
        params: { a: 10, b: 5 },
        outputVariable: 'invalidResult'
      });
      
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'test',
        sessionId: 'test-session-error',
        btConfig: invalidConfig
      });
      
      // Should fail gracefully
      console.log('BT execution result for invalid tool:', JSON.stringify(result, null, 2));
      expect(result.success).toBe(false);
      expect(result.error || result.message || result.status).toBeDefined();
    });
  });
  
  describe('Tool Registry Integration', () => {
    test('should verify ToolRegistry provides real executable tools', async () => {
      // Get add tool directly from ToolRegistry (using actual tool name)
      const addTool = await toolRegistry.getTool('add');
      
      expect(addTool).toBeDefined();
      expect(addTool.name).toBe('add');
      expect(typeof addTool.execute).toBe('function');
      
      // Execute tool directly to verify it works
      const directResult = await addTool.execute({
        a: 42,
        b: 8
      });
      
      expect(directResult.success).toBe(true);
      expect(directResult.result).toBe(50);
    });
    
    test('should verify CapabilityManager uses ToolRegistry for tools', async () => {
      // Access capability manager (internal, but needed for verification)
      const capabilityManager = agent.capabilityManager;
      
      expect(capabilityManager).toBeDefined();
      expect(capabilityManager.toolRegistry).toBeDefined();
      expect(capabilityManager.toolRegistry).toBe(toolRegistry);
      
      // Verify tools are loaded from ToolRegistry
      const tool = capabilityManager.getTool('add');
      expect(tool).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    });
  });
  
  describe('AgentBehaviorTreeExecutor Integration', () => {
    test('should verify BT executor receives and uses ToolRegistry', async () => {
      // Create BT executor through agent
      const createResult = await agent.receive({
        type: 'create_bt_executor',
        from: 'test',
        sessionId: 'executor-test'
      });
      
      expect(createResult.success).toBe(true);
      expect(createResult.metadata).toBeDefined();
      
      // Get BT executor (internal access for verification)
      const btExecutor = agent.btExecutor;
      expect(btExecutor).toBeDefined();
      expect(btExecutor.toolRegistry).toBeDefined();
      expect(btExecutor.toolRegistry).toBe(toolRegistry);
    });
    
    test('should execute workflow with multiple tools', async () => {
      // Create a simple workflow without variable references
      const workflowConfig = {
        type: 'sequence',
        id: 'simple-workflow',
        name: 'Simple Calculator Workflow',
        children: [
          createAgentToolNodeConfig({
            id: 'step1',
            name: 'Add Numbers',
            tool: 'add',
            operation: 'execute',
            params: { a: 100, b: 50 },
            outputVariable: 'sum'
          }),
          createAgentToolNodeConfig({
            id: 'step2',
            name: 'Multiply Numbers',
            tool: 'multiply',
            operation: 'execute',
            params: { a: 10, b: 5 },
            outputVariable: 'product'
          })
        ]
      };
      
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'test',
        sessionId: 'workflow-test',
        btConfig: workflowConfig
      });
      
      expect(result.success).toBe(true);
      expect(result.artifacts.sum.result).toBe(150);      // 100 + 50
      expect(result.artifacts.product.result).toBe(50);   // 10 * 5
    });
  });
});