/**
 * Integration test for complex agent creation with task decomposition
 */

import { jest } from '@jest/globals';
import { MetaAgent } from '../../src/MetaAgent.js';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Complex Agent Creation', () => {
  let metaAgent;
  let resourceManager;
  
  beforeEach(async () => {
    jest.setTimeout(60000); // 60 second timeout for LLM calls
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create MetaAgent
    metaAgent = new MetaAgent({}, resourceManager);
    await metaAgent.initialize();
  });

  afterEach(async () => {
    if (metaAgent) {
      await metaAgent.cleanup();
    }
  });

  test('should create a complex agent with task decomposition', async () => {
    const requirements = {
      purpose: 'Create an agent that fetches data from an API, analyzes it, and generates a report',
      taskType: 'analytical'
    };

    const message = {
      type: 'message',
      content: `/create-complex-agent ${JSON.stringify(requirements)}`,
      from: 'test-user'
    };

    const response = await metaAgent.receive(message);
    
    expect(response.type).toBe('complex_agent_created');
    expect(response.content).toContain('Complex Agent created successfully');
    expect(response.data).toBeDefined();
    
    // Check that decomposition happened
    expect(response.data.decomposition).toBeDefined();
    expect(response.data.decomposition.hierarchy).toBeDefined();
    expect(response.data.decomposition.hierarchy.complexity).toBeDefined();
    
    // Check that tools were discovered
    expect(response.data.tools).toBeDefined();
    expect(response.data.tools.size).toBeGreaterThan(0);
    
    // Check that agent was created
    expect(response.data.agentId).toBeDefined();
    expect(response.data.agentName).toBeDefined();
    expect(response.data.registrationId).toBeDefined();
  });

  test('should create behavior tree for complex tasks', async () => {
    const requirements = {
      purpose: 'Build a multi-step workflow to process orders: validate, charge payment, update inventory, and send confirmation',
      taskType: 'task'
    };

    const message = {
      type: 'message',
      content: `/create-complex-agent ${JSON.stringify(requirements)}`,
      from: 'test-user'
    };

    const response = await metaAgent.receive(message);
    
    expect(response.type).toBe('complex_agent_created');
    expect(response.data.behaviorTree).toBeDefined();
    expect(response.data.behaviorTree.type).toBeDefined();
    expect(response.data.behaviorTree.children).toBeDefined();
    expect(response.data.behaviorTree.children.length).toBeGreaterThan(0);
  });

  test('should detect complexity from natural language', async () => {
    const message = {
      type: 'message',
      content: 'Create an agent that can fetch weather data, analyze trends, and generate a forecast report',
      from: 'test-user'
    };

    const response = await metaAgent.receive(message);
    
    // The natural language handler should detect this needs a complex agent
    expect(response.content).toContain('complex');
    expect(response.content).toContain('task decomposition');
  });

  test('should handle simple agent requests appropriately', async () => {
    const message = {
      type: 'message',
      content: 'Create a chat agent for customer support',
      from: 'test-user'
    };

    const response = await metaAgent.receive(message);
    
    // Should create a standard agent, not complex
    expect(response.content).toContain('standard');
    expect(response.content).not.toContain('complex');
  });

  test('should include data flow in complex agent configuration', async () => {
    const requirements = {
      purpose: 'Create an ETL pipeline agent that extracts data, transforms it, and loads it into a database',
      taskType: 'task'
    };

    const message = {
      type: 'message',
      content: `/create-complex-agent ${JSON.stringify(requirements)}`,
      from: 'test-user'
    };

    const response = await metaAgent.receive(message);
    
    expect(response.type).toBe('complex_agent_created');
    expect(response.data.dataFlow).toBeDefined();
    expect(response.data.dataFlow.size).toBeGreaterThan(0);
    
    // Should have flow between extraction -> transformation -> loading
    const flows = Array.from(response.data.dataFlow.values());
    expect(flows.some(flow => flow.from && flow.to)).toBe(true);
  });

  test('should use semantic search for tool discovery', async () => {
    // Create AgentCreator directly to test tool discovery
    const agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
    
    const requirements = {
      purpose: 'Create a JavaScript code generator',
      taskType: 'creative'
    };
    
    // Decompose the task
    const decomposition = await agentCreator.decomposeRequirements(requirements);
    
    // Discover tools using semantic search
    const tools = await agentCreator.discoverToolsForHierarchy(decomposition.hierarchy);
    
    // Should find JavaScript-related tools through semantic search
    expect(tools.size).toBeGreaterThan(0);
    
    // Check that we found relevant tools (e.g., JavaScript generator tools)
    const toolNames = Array.from(tools);
    const hasRelevantTools = toolNames.some(name => 
      name.toLowerCase().includes('javascript') ||
      name.toLowerCase().includes('js') ||
      name.toLowerCase().includes('generate') ||
      name.toLowerCase().includes('code')
    );
    expect(hasRelevantTools).toBe(true);
    
    await agentCreator.cleanup();
  });

  test('should enhance prompts with decomposition information', async () => {
    const agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
    
    const requirements = {
      purpose: 'Create a data analysis pipeline',
      taskType: 'analytical'
    };
    
    const decomposition = await agentCreator.decomposeRequirements(requirements);
    const tools = await agentCreator.discoverToolsForHierarchy(decomposition.hierarchy);
    const config = await agentCreator.designComplexAgent(requirements, decomposition, tools);
    
    // Check that system prompt includes decomposition steps
    const systemPrompt = config.agent.prompts.system;
    expect(systemPrompt).toContain('To accomplish this');
    
    // Check that it includes hierarchy information if complex
    if (decomposition.hierarchy.complexity === 'COMPLEX') {
      expect(config.taskHierarchy).toBeDefined();
      expect(config.behaviorTree).toBeDefined();
    }
    
    await agentCreator.cleanup();
  });
});