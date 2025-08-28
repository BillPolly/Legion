/**
 * Unit tests for BTAgentBase
 */

import { jest } from '@jest/globals';
import { BTAgentBase } from '../../src/core/BTAgentBase.js';

describe('BTAgentBase', () => {
  let agent;
  let mockConfig;
  let consoleLogSpy;

  beforeEach(() => {
    // Spy on console.log to verify logging
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockConfig = {
      agentId: 'test-agent-123',
      agentType: 'test-type',
      name: 'TestAgent',
      description: 'Test agent description',
      resourceManager: { get: jest.fn(), set: jest.fn() },
      moduleLoader: { load: jest.fn() }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create BTAgentBase with provided config', () => {
      agent = new BTAgentBase(mockConfig);
      
      expect(agent.agentId).toBe('test-agent-123');
      expect(agent.agentType).toBe('test-type');
      expect(agent.name).toBe('TestAgent');
      expect(agent.description).toBe('Test agent description');
      expect(agent.resourceManager).toBe(mockConfig.resourceManager);
      expect(agent.moduleLoader).toBe(mockConfig.moduleLoader);
      expect(agent.initialized).toBe(false);
    });

    it('should generate default values when config is empty', () => {
      agent = new BTAgentBase();
      
      expect(agent.agentId).toMatch(/^sd-agent-\d+-[a-z0-9]+$/);
      expect(agent.agentType).toBe('sd-generic');
      expect(agent.name).toBe('UnnamedAgent');
      expect(agent.description).toBe('');
      expect(agent.resourceManager).toBeNull();
      expect(agent.moduleLoader).toBeNull();
    });

    it('should log initialization message', () => {
      agent = new BTAgentBase(mockConfig);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'BTAgentBase test-agent-123 (test-type) initialized'
      );
    });

    it('should inherit from Actor class', () => {
      agent = new BTAgentBase();
      
      expect(agent.id).toBeDefined();
      expect(agent.id).toMatch(/^actor-\d+-[a-z0-9]+$/);
      expect(typeof agent.receive).toBe('function');
      expect(typeof agent.getMetadata).toBe('function');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      agent = new BTAgentBase(mockConfig);
    });

    it('should initialize agent and set initialized flag', async () => {
      expect(agent.initialized).toBe(false);
      
      await agent.initialize();
      
      expect(agent.initialized).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('BTAgentBase test-agent-123 initialized');
    });

    it('should not reinitialize if already initialized', async () => {
      await agent.initialize();
      consoleLogSpy.mockClear();
      
      await agent.initialize();
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('getResourceManager', () => {
    it('should return the resource manager', () => {
      agent = new BTAgentBase(mockConfig);
      
      const rm = agent.getResourceManager();
      
      expect(rm).toBe(mockConfig.resourceManager);
    });

    it('should return null when no resource manager is set', () => {
      agent = new BTAgentBase();
      
      const rm = agent.getResourceManager();
      
      expect(rm).toBeNull();
    });
  });

  describe('executeBTWorkflow', () => {
    it('should execute a behavior tree workflow', async () => {
      agent = new BTAgentBase(mockConfig);
      
      const workflow = { id: 'workflow-123', name: 'TestWorkflow' };
      const context = { data: 'test' };
      
      const result = await agent.executeBTWorkflow(workflow, context);
      
      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('workflowId', 'workflow-123');
      expect(result.data).toHaveProperty('executionTime');
      expect(result.data).toHaveProperty('results');
    });

    it('should log workflow execution', async () => {
      agent = new BTAgentBase(mockConfig);
      const workflow = { id: 'workflow-456' };
      
      await agent.executeBTWorkflow(workflow, {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TestAgent] Executing BT workflow:',
        'workflow-456'
      );
    });
  });

  describe('receive', () => {
    it('should return error for unhandled message types', async () => {
      agent = new BTAgentBase(mockConfig);
      
      const message = { type: 'execute', task: 'test-task' };
      const envelope = { from: 'sender-123' };
      
      const result = await agent.receive(message, envelope);
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'TestAgent does not handle message type: execute');
    });

    it('should log received messages', async () => {
      agent = new BTAgentBase(mockConfig);
      
      const message = { type: 'test-message' };
      const envelope = { from: 'sender-123' };
      
      await agent.receive(message, envelope);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[TestAgent] Received message:', 'test-message');
    });
  });

  describe('getMetadata', () => {
    it('should return agent metadata', () => {
      agent = new BTAgentBase(mockConfig);
      
      const metadata = agent.getMetadata();
      
      expect(metadata).toHaveProperty('agentId', 'test-agent-123');
      expect(metadata).toHaveProperty('agentType', 'test-type');
      expect(metadata).toHaveProperty('name', 'TestAgent');
      expect(metadata).toHaveProperty('description', 'Test agent description');
      expect(metadata).toHaveProperty('initialized', false);
    });

    it('should reflect initialization state in metadata', async () => {
      agent = new BTAgentBase(mockConfig);
      await agent.initialize();
      
      const metadata = agent.getMetadata();
      
      expect(metadata).toHaveProperty('initialized', true);
    });
  });

  describe('createExecutionContext', () => {
    it('should create execution context with agent data', () => {
      agent = new BTAgentBase(mockConfig);
      
      const contextData = { workflow: 'test-workflow', step: 1 };
      const context = agent.createExecutionContext(contextData);
      
      expect(context).toHaveProperty('timestamp');
      expect(context).toHaveProperty('agentId', 'test-agent-123');
      expect(context).toHaveProperty('agentType', 'test-type');
      expect(context).toHaveProperty('workflow', 'test-workflow');
      expect(context).toHaveProperty('step', 1);
    });

    it('should generate timestamp in ISO format', () => {
      agent = new BTAgentBase(mockConfig);
      
      const context = agent.createExecutionContext({});
      
      expect(context.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });
});