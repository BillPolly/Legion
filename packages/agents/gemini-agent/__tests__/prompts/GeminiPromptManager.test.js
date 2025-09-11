/**
 * Unit tests for GeminiPromptManager (ported prompt functionality)
 */

import { GeminiPromptManager } from '../../src/prompts/GeminiPromptManager.js';

describe('GeminiPromptManager', () => {
  let promptManager;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: (key) => {
        if (key === 'env.PWD') return '/test/working/directory';
        if (key === 'workingDirectory') return '/test/working/directory';
        if (key === 'env.NODE_VERSION') return 'v18.0.0';
        if (key === 'env.PLATFORM') return 'darwin';
        return 'mock-value';
      }
    };
    promptManager = new GeminiPromptManager(mockResourceManager);
  });

  test('should create prompt manager with resource manager', () => {
    expect(promptManager.resourceManager).toBe(mockResourceManager);
  });

  test('should build system prompt with all components', async () => {
    const systemPrompt = await promptManager.buildSystemPrompt();
    
    expect(typeof systemPrompt).toBe('string');
    expect(systemPrompt.length).toBeGreaterThan(0);
    
    // Should contain key sections (ported from Gemini CLI)
    expect(systemPrompt).toContain('interactive CLI agent');
    expect(systemPrompt).toContain('Core Mandates');
    expect(systemPrompt).toContain('Software Engineering Tasks');
    expect(systemPrompt).toContain('Available Tools');
  });

  test('should include user memory when provided', async () => {
    const userMemory = 'User prefers TypeScript and uses ESLint';
    const systemPrompt = await promptManager.buildSystemPrompt(userMemory);
    
    expect(systemPrompt).toContain('User Memory:');
    expect(systemPrompt).toContain(userMemory);
  });

  test('should build compression prompt with proper structure', () => {
    const compressionPrompt = promptManager.getCompressionPrompt();
    
    expect(typeof compressionPrompt).toBe('string');
    expect(compressionPrompt).toContain('summarizes internal chat history');
    expect(compressionPrompt).toContain('<state_snapshot>');
    expect(compressionPrompt).toContain('<user_goal>');
    expect(compressionPrompt).toContain('<project_context>');
    expect(compressionPrompt).toContain('<completed_actions>');
  });

  test('should build directory context', async () => {
    const dirContext = await promptManager.getDirectoryContext();
    
    expect(dirContext).toContain('Current Directory');
    expect(dirContext).toContain('Working directory:');
    expect(dirContext).toContain('/test/working/directory'); // From mock ResourceManager
  });

  test('should build environment context', async () => {
    const envContext = await promptManager.getEnvironmentContext();
    
    expect(envContext).toContain('Environment');
    expect(envContext).toContain('Platform:');
    expect(envContext).toContain('Node.js:');
    expect(envContext).toContain('v18.0.0'); // Node version from mock
    expect(envContext).toContain('darwin'); // Platform from mock
  });

  test('should build tool descriptions', async () => {
    const toolDescriptions = await promptManager.getToolDescriptions();
    
    expect(toolDescriptions).toContain('Available Tools');
    expect(toolDescriptions).toContain('read_file');
    expect(toolDescriptions).toContain('write_file');
    expect(toolDescriptions).toContain('edit_file');
    expect(toolDescriptions).toContain('shell_command');
    expect(toolDescriptions).toContain('grep_search');
  });

  test('should handle errors gracefully in context building', async () => {
    // Test that context building doesn't fail even if there are errors
    const dirContext = await promptManager.getDirectoryContext();
    const envContext = await promptManager.getEnvironmentContext();
    
    expect(typeof dirContext).toBe('string');
    expect(typeof envContext).toBe('string');
  });
});