/**
 * TaskOrchestrator Unit Tests
 * 
 * Focused unit tests for individual TaskOrchestrator components
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TaskOrchestrator } from '../TaskOrchestrator.js';
import { PlanExecution } from '../PlanExecution.js';
import { PlanExecutionEngine } from '../PlanExecutionEngine.js';
import { UserInteractionHandler } from '../UserInteractionHandler.js';

// Mock dependencies
const createMockResourceManager = () => ({
  get: jest.fn(),
  register: jest.fn(),
  createLLMClient: jest.fn().mockResolvedValue({
    complete: jest.fn().mockResolvedValue('Mock LLM response')
  })
});

const createMockModuleLoader = () => ({
  initialize: jest.fn(),
  loadAllFromRegistry: jest.fn().mockResolvedValue({ successful: [], failed: [] }),
  getTool: jest.fn(),
  hasModule: jest.fn().mockReturnValue(true)
});

const createMockChatAgent = () => ({
  orchestratorActive: false,
  handleOrchestratorMessage: jest.fn(),
  sendArtifactEventToDebugActor: jest.fn()
});

const createMockArtifactManager = () => ({
  registerArtifact: jest.fn().mockReturnValue({ id: 'test-artifact', label: '@plan1' }),
  getArtifactsByType: jest.fn().mockReturnValue([])
});

describe('TaskOrchestrator Unit Tests', () => {
  let orchestrator;
  let mockResourceManager;
  let mockModuleLoader;
  let mockChatAgent;
  let mockArtifactManager;
  
  beforeEach(() => {
    mockResourceManager = createMockResourceManager();
    mockModuleLoader = createMockModuleLoader();
    mockChatAgent = createMockChatAgent();
    mockArtifactManager = createMockArtifactManager();
    
    orchestrator = new TaskOrchestrator({
      sessionId: 'test-session',
      chatAgent: mockChatAgent,
      resourceManager: mockResourceManager,
      moduleLoader: mockModuleLoader,
      artifactManager: mockArtifactManager
    });
  });
  
  describe('TaskOrchestrator Constructor', () => {
    test('should initialize with correct components', () => {
      expect(orchestrator.id).toMatch(/task-orchestrator-\d+-[a-z0-9]+/);
      expect(orchestrator.sessionId).toBe('test-session');
      expect(orchestrator.chatAgent).toBe(mockChatAgent);
      expect(orchestrator.resourceManager).toBe(mockResourceManager);
      expect(orchestrator.moduleLoader).toBe(mockModuleLoader);
      expect(orchestrator.artifactManager).toBe(mockArtifactManager);
      
      // Components should be created
      expect(orchestrator.interactionHandler).toBeInstanceOf(UserInteractionHandler);
      expect(orchestrator.planExecution).toBeInstanceOf(PlanExecution);
      expect(orchestrator.planExecutionEngine).toBeInstanceOf(PlanExecutionEngine);
      
      // Initial state
      expect(orchestrator.currentTask).toBeNull();
      expect(orchestrator.llmClient).toBeNull();
    });
  });
  
  describe('Initialization', () => {
    test('should initialize LLM client from ResourceManager', async () => {
      const mockLLMClient = { complete: jest.fn() };
      mockResourceManager.createLLMClient.mockResolvedValue(mockLLMClient);
      
      await orchestrator.initialize();
      
      expect(mockResourceManager.createLLMClient).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxRetries: 3
      });
      expect(orchestrator.llmClient).toBe(mockLLMClient);
    });
    
    test('should handle LLM client initialization failure gracefully', async () => {
      mockResourceManager.createLLMClient.mockRejectedValue(new Error('API key missing'));
      
      // Should not throw
      await expect(orchestrator.initialize()).resolves.not.toThrow();
      expect(orchestrator.llmClient).toBeNull();
    });
  });
  
  describe('Message Handling', () => {
    test('should handle start_task message', async () => {
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      const payload = {
        type: 'start_task',
        description: 'Test task',
        agentContext: mockAgentContext
      };
      
      // Mock plan execution start
      jest.spyOn(orchestrator.planExecution, 'start').mockResolvedValue();
      
      await orchestrator.receive(payload);
      
      expect(orchestrator.currentTask).toEqual({
        description: 'Test task',
        context: {},
        conversationHistory: []
      });
      expect(orchestrator.planExecution.start).toHaveBeenCalledWith('Test task', {});
    });
    
    test('should handle execute_plan message', async () => {
      const mockPlan = { id: 'test-plan', status: 'validated' };
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      const payload = {
        type: 'execute_plan',
        plan: mockPlan,
        options: { workspaceDir: '/tmp' },
        agentContext: mockAgentContext
      };
      
      // Mock execution engine
      jest.spyOn(orchestrator.planExecutionEngine, 'executePlan').mockResolvedValue();
      orchestrator.planExecutionEngine.state = 'idle';
      
      await orchestrator.receive(payload);
      
      expect(orchestrator.planExecutionEngine.executePlan).toHaveBeenCalledWith(mockPlan, { workspaceDir: '/tmp' });
    });
    
    test('should handle user_message', async () => {
      const payload = {
        type: 'user_message',
        content: 'status'
      };
      
      jest.spyOn(orchestrator.interactionHandler, 'processUserInput').mockResolvedValue();
      
      await orchestrator.receive(payload);
      
      expect(orchestrator.interactionHandler.processUserInput).toHaveBeenCalledWith(payload);
    });
    
    test('should handle unknown message types', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await orchestrator.receive({ type: 'unknown_type' });
      
      expect(consoleSpy).toHaveBeenCalledWith('TaskOrchestrator: Unknown message type:', 'unknown_type');
      consoleSpy.mockRestore();
    });
  });
  
  describe('Busy State Handling', () => {
    test('should reject new tasks when planning is active', async () => {
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      orchestrator.planExecution.state = 'planning';
      
      const payload = {
        type: 'start_task',
        description: 'Second task',
        agentContext: mockAgentContext
      };
      
      await orchestrator.receive(payload);
      
      expect(mockAgentContext.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        type: 'chat_response',
        content: expect.stringContaining('already working'),
        isComplete: true
      }));
    });
    
    test('should reject new execution when already executing', async () => {
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      orchestrator.planExecutionEngine.state = 'executing';
      
      const payload = {
        type: 'execute_plan',
        plan: { id: 'test' },
        agentContext: mockAgentContext
      };
      
      await orchestrator.receive(payload);
      
      expect(mockAgentContext.emit).toHaveBeenCalledWith('message', expect.objectContaining({
        content: expect.stringContaining('already executing')
      }));
    });
  });
  
  describe('Chat Agent Communication', () => {
    test('should send messages via agentContext when available', () => {
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      orchestrator.agentContext = mockAgentContext;
      
      orchestrator.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Test message',
        progress: 50
      });
      
      expect(mockAgentContext.emit).toHaveBeenCalledWith('message', {
        sessionId: 'test',
        timestamp: expect.any(String),
        type: 'chat_response',
        content: 'Test message',
        isComplete: false,
        progress: 50
      });
    });
    
    test('should send thoughts via agentContext', () => {
      const mockAgentContext = { emit: jest.fn(), sessionId: 'test' };
      orchestrator.agentContext = mockAgentContext;
      
      orchestrator.sendThoughtToUser('Test thought');
      
      expect(mockAgentContext.emit).toHaveBeenCalledWith('agent_thought', {
        type: 'agent_thought',
        thought: 'Test thought',
        sessionId: 'test',
        timestamp: expect.any(String)
      });
    });
    
    test('should fall back to chatAgent when agentContext not available', () => {
      orchestrator.agentContext = null;
      orchestrator.planExecution.state = 'idle';
      
      orchestrator.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Test message'
      });
      
      expect(mockChatAgent.handleOrchestratorMessage).toHaveBeenCalledWith({
        type: 'orchestrator_status',
        message: 'Test message',
        orchestratorId: orchestrator.id,
        sessionId: 'test-session',
        timestamp: expect.any(String),
        isActive: false
      });
    });
  });
  
  describe('Resource Cleanup', () => {
    test('should clean up resources on destroy', () => {
      jest.spyOn(orchestrator.planExecution, 'clearTimers').mockImplementation();
      jest.spyOn(orchestrator.planExecutionEngine, 'clearResources').mockImplementation();
      
      orchestrator.destroy();
      
      expect(orchestrator.planExecution.clearTimers).toHaveBeenCalled();
      expect(orchestrator.planExecutionEngine.clearResources).toHaveBeenCalled();
      expect(orchestrator.currentTask).toBeNull();
      expect(orchestrator.chatAgent).toBeNull();
    });
  });
});