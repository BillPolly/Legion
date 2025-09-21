import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import RequirementsAnalyzer from '../../../src/strategies/coding/components/RequirementsAnalyzer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('RequirementsAnalyzer Prompt Loading', () => {
  let resourceManager;
  let llmClient;
  let analyzer;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    analyzer = new RequirementsAnalyzer(llmClient);
  });

  it('should load prompts from markdown files', async () => {
    // Test that the prompt registry is initialized
    expect(analyzer.promptRegistry).toBeDefined();
    
    // Test loading a prompt template
    const template = await analyzer.promptRegistry.load('coding/requirements/analyze');
    expect(template).toBeDefined();
    expect(template.content).toBeDefined();
    expect(template.metadata).toBeDefined();
    expect(template.metadata.category).toBe('coding');
  });

  it('should fill prompt templates with variables', async () => {
    const requirements = 'Create a simple REST API';
    const filled = await analyzer.promptRegistry.fill('coding/requirements/analyze', {
      requirements
    });
    
    expect(filled).toBeDefined();
    expect(filled).toContain(requirements);
    expect(filled).not.toContain('{{requirements}}');
  });

  it('should analyze requirements with new prompt system', async () => {
    const requirements = 'Create a simple REST API with user authentication';
    
    const analysis = await analyzer.analyze(requirements);
    
    expect(analysis).toBeDefined();
    expect(analysis.type).toMatch(/api|web|cli|library/);
    expect(Array.isArray(analysis.features)).toBe(true);
    expect(Array.isArray(analysis.technologies)).toBe(true);
  }, 30000); // 30 second timeout for LLM call
});