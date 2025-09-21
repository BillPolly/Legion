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
    // Test that the prompt registry is initialized
    expect(toolDiscovery.promptRegistry).toBeDefined();
    
    // Test loading a prompt template
    const template = await toolDiscovery.promptRegistry.load('utils/tools/generate-descriptions');
    expect(template).toBeDefined();
    expect(template.content).toBeDefined();
    expect(template.metadata).toBeDefined();
    expect(template.metadata.category).toBe('utils');
  });

  it('should fill prompt templates with variables', async () => {
    const taskDescription = 'Create a REST API endpoint';
    const filled = await toolDiscovery.promptRegistry.fill('utils/tools/generate-descriptions', {
      taskDescription,
      minDescriptions: 5,
      maxDescriptions: 10
    });
    
    expect(filled).toBeDefined();
    expect(filled).toContain(taskDescription);
    expect(filled).not.toContain('{{taskDescription}}');
    expect(filled).toContain('5-10');
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