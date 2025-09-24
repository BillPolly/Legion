import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import ToolDiscovery from '../../../src/strategies/utils/ToolDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ToolDiscovery Prompt Loading', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let toolDiscovery;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    // Get ToolRegistry singleton
    toolRegistry = await ToolRegistry.getInstance();
  });

  beforeEach(() => {
    toolDiscovery = new ToolDiscovery(llmClient, toolRegistry);
  });

  it('should load prompts from markdown files', async () => {
    // Test that the prompt loader is initialized
    expect(toolDiscovery.promptLoader).toBeDefined();
    
    // Test loading a prompt configuration
    const config = await toolDiscovery.promptLoader.loadPromptConfig('utils/tools/generate-descriptions');
    expect(config).toBeDefined();
    expect(config.template).toBeDefined();
    expect(config.metadata).toBeDefined();
    expect(config.metadata.category).toBe('utils');
    expect(config.responseSchema).toBeDefined();
    expect(config.examples).toBeDefined();
  });

  it('should initialize prompt configuration correctly', async () => {
    // Call ensurePrompts to initialize the prompt data
    await toolDiscovery.ensurePrompts();
    
    // Verify that prompt configuration is loaded
    expect(toolDiscovery.promptTemplate).toBeDefined();
    expect(toolDiscovery.responseSchema).toBeDefined();
    expect(toolDiscovery.examples).toBeDefined();
    expect(toolDiscovery.outputPrompt).toBeDefined();
    
    // Verify template contains placeholder variables
    expect(toolDiscovery.promptTemplate).toContain('{{taskDescription}}');
    expect(toolDiscovery.promptTemplate).toContain('{{minDescriptions}}');
    expect(toolDiscovery.promptTemplate).toContain('{{maxDescriptions}}');
    
    // Verify schema structure
    expect(toolDiscovery.responseSchema.type).toBe('array');
    expect(toolDiscovery.responseSchema.items.type).toBe('string');
  });

  it('should generate tool descriptions with new prompt system', async () => {
    const taskDescription = 'Create a simple file reader utility';
    
    const descriptions = await toolDiscovery.generateToolDescriptions(taskDescription);
    
    expect(descriptions).toBeDefined();
    expect(Array.isArray(descriptions)).toBe(true);
    expect(descriptions.length).toBeGreaterThanOrEqual(5);
    descriptions.forEach(desc => {
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(10);
    });
  }, 30000); // 30 second timeout for LLM call
});