/**
 * Behavior Tree Orchestration Scenario Tests
 * Tests complete BT workflows through actual execution
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { 
  createConversationFlowConfig,
  createTaskExecutionConfig,
  createWorkflowConfig,
  createAgentChatNodeConfig,
  createAgentToolNodeConfig,
  createAgentQueryNodeConfig,
  createAgentStateNodeConfig
} from '../../src/bt/AgentBTConfig.js';

describe('Behavior Tree Orchestration Scenarios', () => {
  let resourceManager;
  let agent;

  beforeAll(async () => {
    // Get ResourceManager singleton
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    // Verify LLM client is available
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();

    // Create agent with safe configuration (avoiding Jest contamination)
    const agentConfig = {
      agent: {
        id: 'orchestration-test-agent',
        name: 'OrchestrationTestAgent',
        type: 'conversational',
        version: '1.0.0',
        capabilities: [
          {
            module: 'calculator',
            tools: ['add', 'subtract', 'multiply', 'divide'],
            permissions: { read: true, write: true, execute: true }
          }
        ],
        llm: {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          temperature: 0.1,
          maxTokens: 200,
          systemPrompt: 'You are a helpful assistant that can perform calculations and answer questions.'
        },
        prompts: {
          responseFormats: { 
            default: {
              type: 'text',
              includeMetadata: false
            }
          }
        },
        state: {
          maxHistorySize: 50,
          pruneStrategy: 'sliding',
          contextVariables: {
            testMode: { type: 'boolean', persistent: false }
          }
        }
      }
    };

    agent = new ConfigurableAgent(agentConfig, resourceManager);
    await agent.initialize();
    expect(agent.initialized).toBe(true);
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.receive({ type: 'shutdown', from: 'test' });
    }
  });

  describe('Conversation Flow Scenarios', () => {
    it('should execute complete conversation flow with capabilities query and chat', async () => {
      const sessionId = `conversation-test-${Date.now()}`;
      
      // Create conversation flow with capabilities query
      const conversationFlow = createConversationFlowConfig({
        sessionId,
        userMessage: 'What can you help me with?',
        queryCapabilities: true,
        saveState: false
      });

      // Execute through agent BT message handling
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: conversationFlow,
        userInput: 'What can you help me with?'
      });

      expect(result.type).toBe('bt_execution_result');
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.agentData).toBeDefined();
      expect(result.agentData.agentName).toBe('OrchestrationTestAgent');
      expect(result.agentData.sessionId).toBe(sessionId);
      
      // Verify artifacts contain both capabilities and chat response
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.capabilities).toBeDefined();
      expect(result.artifacts.chatResponse).toBeDefined();
    }, 30000);

    it('should handle conversation flow with state saving', async () => {
      const sessionId = `conversation-save-test-${Date.now()}`;
      
      const conversationFlow = createConversationFlowConfig({
        sessionId,
        userMessage: 'Remember that my favorite color is blue',
        queryCapabilities: false,
        saveState: true
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: conversationFlow,
        userInput: 'Remember that my favorite color is blue'
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.chatResponse).toBeDefined();
      expect(result.artifacts.saveResult).toBeDefined();
    }, 30000);
  });

  describe('Task Execution Scenarios', () => {
    it('should execute tool task with discussion', async () => {
      const sessionId = `task-test-${Date.now()}`;
      
      const taskExecution = createTaskExecutionConfig({
        sessionId,
        toolName: 'calculator',
        operation: 'add',
        params: { a: 15, b: 27 },
        chatAfterExecution: true
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: taskExecution
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.toolResult).toBeDefined();
      expect(result.artifacts.discussionResponse).toBeDefined();
      expect(result.artifacts.stateUpdate).toBeDefined();
      
      // Verify task completion was recorded in state
      const stateUpdate = result.artifacts.stateUpdate;
      expect(stateUpdate.lastTask).toBe('calculator');
      expect(stateUpdate.lastOperation).toBe('add');
      expect(stateUpdate.taskCompleted).toBe(true);
    }, 30000);

    it('should execute simple tool task without discussion', async () => {
      const sessionId = `simple-task-test-${Date.now()}`;
      
      const taskExecution = createTaskExecutionConfig({
        sessionId,
        toolName: 'calculator',
        operation: 'multiply',
        params: { a: 8, b: 9 },
        chatAfterExecution: false
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: taskExecution
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.toolResult).toBeDefined();
      expect(result.artifacts.discussionResponse).toBeUndefined();
      expect(result.artifacts.stateUpdate).toBeDefined();
    }, 30000);
  });

  describe('Multi-Step Workflow Scenarios', () => {
    it('should execute complete workflow with mixed step types', async () => {
      const sessionId = `workflow-test-${Date.now()}`;
      
      const workflowSteps = [
        {
          type: 'chat',
          name: 'Greet User',
          message: 'Starting calculation workflow'
        },
        {
          type: 'tool',
          name: 'First Calculation',
          tool: 'calculator',
          operation: 'add',
          params: { a: 10, b: 5 }
        },
        {
          type: 'tool', 
          name: 'Second Calculation',
          tool: 'calculator',
          operation: 'multiply',
          params: { a: 15, b: 2 }
        },
        {
          type: 'query',
          name: 'Check Status',
          query: 'What is your current status?',
          queryType: 'status'
        },
        {
          type: 'state',
          name: 'Update Workflow State',
          action: 'update',
          updates: {
            workflowType: 'calculation',
            stepsCompleted: 4,
            finalResult: 'workflow-complete'
          }
        }
      ];

      const workflow = createWorkflowConfig({
        sessionId,
        steps: workflowSteps,
        rollbackOnFailure: false
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: workflow
      });

      expect(result.success).toBe(true);
      
      // Verify all step results are present
      expect(result.artifacts.step1Result).toBeDefined(); // chat
      expect(result.artifacts.step2Result).toBeDefined(); // tool
      expect(result.artifacts.step3Result).toBeDefined(); // tool
      expect(result.artifacts.step4Result).toBeDefined(); // query
      expect(result.artifacts.step5Result).toBeDefined(); // state
      expect(result.artifacts.workflowCompletion).toBeDefined();
      
      // Verify workflow completion state
      const completion = result.artifacts.workflowCompletion;
      expect(completion.workflowCompleted).toBe(true);
      expect(completion.workflowSteps).toBe(5);
    }, 45000);

    it('should handle workflow with rollback capability', async () => {
      const sessionId = `rollback-workflow-test-${Date.now()}`;
      
      const workflowSteps = [
        {
          type: 'state',
          name: 'Set Test Variable',
          action: 'update',
          updates: { testVariable: 'initial-value' }
        },
        {
          type: 'tool',
          name: 'Valid Calculation',
          tool: 'calculator',
          operation: 'add',
          params: { a: 5, b: 10 }
        }
      ];

      const workflow = createWorkflowConfig({
        sessionId,
        steps: workflowSteps,
        rollbackOnFailure: true
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: workflow
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.initialState).toBeDefined();
      expect(result.artifacts.step1Result).toBeDefined();
      expect(result.artifacts.step2Result).toBeDefined();
    }, 30000);
  });

  describe('Individual Node Type Scenarios', () => {
    it('should execute agent chat node independently', async () => {
      const sessionId = `chat-node-test-${Date.now()}`;
      
      const chatNodeConfig = createAgentChatNodeConfig({
        sessionId,
        message: 'Explain what 2+2 equals in a friendly way',
        outputVariable: 'friendlyExplanation'
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: chatNodeConfig
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.friendlyExplanation).toBeDefined();
      expect(result.agentData.agentInteractions.chatMessages).toBe(1);
    }, 20000);

    it('should execute agent tool node independently', async () => {
      const sessionId = `tool-node-test-${Date.now()}`;
      
      const toolNodeConfig = createAgentToolNodeConfig({
        sessionId,
        tool: 'calculator',
        operation: 'subtract',
        params: { a: 100, b: 42 },
        outputVariable: 'calculationResult'
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: toolNodeConfig
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.calculationResult).toBeDefined();
      expect(result.agentData.agentInteractions.toolExecutions).toBe(1);
    }, 15000);

    it('should execute agent query node independently', async () => {
      const sessionId = `query-node-test-${Date.now()}`;
      
      const queryNodeConfig = createAgentQueryNodeConfig({
        sessionId,
        query: 'What tools are available?',
        queryType: 'capabilities',
        outputVariable: 'availableTools'
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: queryNodeConfig
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.availableTools).toBeDefined();
      expect(result.agentData.agentInteractions.queries).toBe(1);
    }, 15000);

    it('should execute agent state node independently', async () => {
      const sessionId = `state-node-test-${Date.now()}`;
      
      const stateNodeConfig = createAgentStateNodeConfig({
        action: 'update',
        updates: {
          testScenario: 'orchestration-test',
          timestamp: Date.now(),
          nodeType: 'agent_state'
        },
        outputVariable: 'stateUpdateResult'
      });

      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId,
        btConfig: stateNodeConfig
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.stateUpdateResult).toBeDefined();
      expect(result.agentData.agentInteractions.stateOperations).toBe(1);
    }, 15000);
  });

  describe('BT Executor Management Scenarios', () => {
    it('should create BT executor on demand', async () => {
      const sessionId = `executor-test-${Date.now()}`;
      
      const result = await agent.receive({
        type: 'create_bt_executor',
        from: 'orchestration-test',
        sessionId,
        debugMode: true,
        options: { customOption: 'test-value' }
      });

      expect(result.type).toBe('bt_executor_created');
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.agentAvailable).toBe(true);
      expect(result.metadata.agentName).toBe('OrchestrationTestAgent');
    }, 10000);

    it('should provide BT executor metadata', () => {
      const metadata = agent.getBTExecutorMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.btExecutorAvailable).toBe(true);
      expect(metadata.agentAvailable).toBe(true);
      expect(metadata.agentName).toBe('OrchestrationTestAgent');
      expect(metadata.nodeTypesRegistered).toContain('agent_chat');
      expect(metadata.nodeTypesRegistered).toContain('agent_tool');
      expect(metadata.nodeTypesRegistered).toContain('agent_query');
      expect(metadata.nodeTypesRegistered).toContain('agent_state');
    });

    it('should execute through direct BT executor methods', async () => {
      const chatResult = await agent.executeAgentChat('Hello from direct executor', {
        sessionId: 'direct-executor-test'
      });

      expect(chatResult.success).toBe(true);
      expect(chatResult.artifacts).toBeDefined();
      expect(chatResult.artifacts.chatResponse).toBeDefined();

      const toolResult = await agent.executeAgentTool('calculator', 'divide', { a: 84, b: 12 }, {
        sessionId: 'direct-tool-test'
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.artifacts.toolResponse).toBeDefined();
    }, 30000);
  });

  describe('Error Handling Scenarios', () => {
    it('should handle invalid BT configuration gracefully', async () => {
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId: 'error-test',
        btConfig: {
          type: 'invalid_node_type',
          id: 'invalid-node'
        }
      });

      expect(result.type).toBe('bt_execution_error');
      expect(result.error).toContain('Invalid BT configuration');
    });

    it('should handle missing BT configuration', async () => {
      const result = await agent.receive({
        type: 'execute_bt',
        from: 'orchestration-test',
        sessionId: 'missing-config-test'
        // btConfig intentionally missing
      });

      expect(result.type).toBe('bt_execution_error');
      expect(result.error).toContain('Behavior tree configuration is required');
    });
  });
});