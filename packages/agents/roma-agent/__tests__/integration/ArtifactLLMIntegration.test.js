/**
 * Integration tests for artifact management with real LLM interaction
 * Tests complete workflow: LLM generates tool calls → tools execute → artifacts stored → artifacts reused
 * 
 * This test suite validates:
 * - LLM receives proper artifact catalog and conversation history
 * - LLM generates valid tool calls with output specifications
 * - Tools execute with resolved artifact references
 * - Artifacts are stored according to LLM specifications
 * - Subsequent LLM calls can reference and use stored artifacts
 * - End-to-end artifact lifecycle works correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionStrategy } from '../../src/core/strategies/ExecutionStrategy.js';
import { ExecutionContext } from '../../src/core/ExecutionContext.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Artifact LLM Integration - Real LLM Tests', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockFileWriteTool;
  let mockFileReadTool;
  let mockServerStartTool;
  let resourceManager;
  let llmClient;

  beforeEach(async () => {
    // Get real ResourceManager and LLM client
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();

    // Create mock tools that simulate real tool behavior
    mockFileWriteTool = {
      name: 'file_write',
      description: 'Write content to a file',
      execute: jest.fn().mockImplementation(async (params) => {
        // Simulate actual file writing behavior
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate I/O delay
        return {
          success: true,
          data: { 
            filepath: params.filepath, 
            size: params.content ? params.content.length : 0,
            encoding: 'utf-8'
          },
          metadata: { 
            toolName: 'file_write', 
            operation: 'write',
            timestamp: Date.now()
          }
        };
      })
    };

    mockFileReadTool = {
      name: 'file_read',
      description: 'Read content from a file',
      execute: jest.fn().mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          success: true,
          data: { 
            content: `// File content from ${params.filepath}\nconst express = require('express');\nmodule.exports = express;`,
            encoding: 'utf-8',
            size: 150
          },
          metadata: { 
            toolName: 'file_read', 
            operation: 'read',
            filepath: params.filepath
          }
        };
      })
    };

    mockServerStartTool = {
      name: 'start_server',
      description: 'Start a server process',
      execute: jest.fn().mockImplementation(async (params) => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return {
          success: true,
          data: { 
            pid: Math.floor(Math.random() * 10000) + 1000,
            port: params.port || 3000,
            status: 'running',
            startTime: Date.now()
          },
          metadata: { 
            toolName: 'start_server', 
            operation: 'start',
            scriptPath: params.scriptPath
          }
        };
      })
    };

    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockImplementation((toolName) => {
        switch (toolName) {
          case 'file_write': return mockFileWriteTool;
          case 'file_read': return mockFileReadTool;
          case 'start_server': return mockServerStartTool;
          default: return null;
        }
      }),
      getAllTools: jest.fn().mockReturnValue([
        mockFileWriteTool,
        mockFileReadTool, 
        mockServerStartTool
      ])
    };

    // Create strategy with real LLM and mock tools
    strategy = new ExecutionStrategy({
      toolRegistry: mockToolRegistry,
      llmClient: llmClient,
      resourceManager: resourceManager
    });

    // Initialize the strategy
    await strategy.initialize();

    // Create context
    context = new ExecutionContext();
  });

  describe('LLM Prompt Formatting with Artifacts', () => {
    it('should format conversation history for LLM', () => {
      // Add some conversation history
      context.conversationHistory.push({
        role: 'user',
        content: 'Create a web server',
        timestamp: Date.now()
      });
      context.conversationHistory.push({
        role: 'assistant',
        content: 'I will create a server file for you',
        timestamp: Date.now()
      });

      const formatted = strategy.formatConversationHistory(context);
      
      expect(formatted).toContain('User: Create a web server');
      expect(formatted).toContain('Assistant: I will create a server file for you');
    });

    it('should format artifacts catalog for LLM', () => {
      // Add some artifacts
      context.addArtifact('server_config', {
        type: 'data',
        value: { port: 3000, host: 'localhost' },
        description: 'Server configuration object',
        purpose: 'Configure the Express server',
        timestamp: Date.now()
      });

      context.addArtifact('server_file', {
        type: 'file',
        value: '/tmp/server.js',
        description: 'Express server implementation',
        purpose: 'Main server entry point',
        timestamp: Date.now()
      });

      const catalog = strategy.formatArtifactsCatalog(context);
      
      expect(catalog).toContain('Available Artifacts (2)');
      expect(catalog).toContain('@server_config (data): Server configuration object');
      expect(catalog).toContain('@server_file (file): Express server implementation');
      expect(catalog).toContain('Purpose: Configure the Express server');
      expect(catalog).toContain('Purpose: Main server entry point');
    });

    it('should build complete prompt with conversation and artifacts', () => {
      context.conversationHistory.push({
        role: 'user',
        content: 'Create a Node.js server',
        timestamp: Date.now()
      });

      context.addArtifact('config', {
        type: 'data',
        value: { port: 8080 },
        description: 'Server configuration',
        purpose: 'Define server settings',
        timestamp: Date.now()
      });

      const task = { description: 'Write a simple Express server' };
      const prompt = strategy.buildPrompt(task, context);

      expect(prompt).toContain('## Conversation History');
      expect(prompt).toContain('User: Create a Node.js server');
      expect(prompt).toContain('## Available Artifacts');
      expect(prompt).toContain('@config (data): Server configuration');
      expect(prompt).toContain('## Current Task');
      expect(prompt).toContain('Write a simple Express server');
      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('Reference existing artifacts using @artifact_name');
    });
  });

  describe('Real LLM Tool Call Generation', () => {
    it('should get valid tool call from LLM for file creation task', async () => {
      const task = {
        description: 'Create a simple Express.js server file that listens on port 3000'
      };

      // Add conversation context
      context.conversationHistory.push({
        role: 'user',
        content: 'Create a simple Express.js server file',
        timestamp: Date.now()
      });

      const prompt = strategy.buildPrompt(task, context);
      
      const response = await llmClient.request({
        prompt: prompt,
        maxTokens: 2000,
        temperature: 0.1  // Low temperature for more predictable responses
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      // Try to parse tool call from response
      let toolCall;
      try {
        // LLM might return JSON directly or wrapped in markdown
        const content = response.content.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        expect(jsonMatch).toBeTruthy();
        
        toolCall = JSON.parse(jsonMatch[0]);
      } catch (error) {
        // Log the response for debugging
        console.log('LLM Response:', response.content);
        throw new Error(`Failed to parse tool call from LLM response: ${error.message}`);
      }

      // Validate tool call structure
      expect(toolCall.tool).toBeDefined();
      expect(toolCall.inputs).toBeDefined();
      expect(toolCall.outputs).toBeDefined();
      expect(Array.isArray(toolCall.outputs)).toBe(true);
      expect(toolCall.outputs.length).toBeGreaterThan(0);

      // Validate output specification
      const output = toolCall.outputs[0];
      expect(output.name).toBeDefined();
      expect(output.type).toBeDefined();
      expect(output.description).toBeDefined();
      expect(typeof output.name).toBe('string');
      expect(typeof output.type).toBe('string');
      expect(typeof output.description).toBe('string');
    }, 30000); // 30 second timeout for LLM call

    it('should generate tool call that references existing artifacts', async () => {
      // Add existing artifacts to context
      context.addArtifact('server_config', {
        type: 'data',
        value: { port: 3000, host: 'localhost', env: 'development' },
        description: 'Server configuration object',
        purpose: 'Configuration for the Express server',
        timestamp: Date.now()
      });

      context.addArtifact('server_template', {
        type: 'file',
        value: '/tmp/server-template.js',
        description: 'Server template file',
        purpose: 'Base template for server creation',
        timestamp: Date.now()
      });

      const task = {
        description: 'Create a configured server file using the existing server configuration and template'
      };

      // Add conversation context
      context.conversationHistory.push({
        role: 'user',
        content: 'Use the existing server config and template to create a new server file',
        timestamp: Date.now()
      });

      const prompt = strategy.buildPrompt(task, context);
      const response = await llmClient.request({
        prompt: prompt,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Parse tool call
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const toolCall = JSON.parse(jsonMatch[0]);

      // Check if LLM referenced existing artifacts
      const inputsStr = JSON.stringify(toolCall.inputs);
      const hasArtifactReference = inputsStr.includes('@server_config') || 
                                  inputsStr.includes('@server_template') ||
                                  inputsStr.includes('@');

      expect(hasArtifactReference).toBe(true);
    }, 30000);
  });

  describe('Complete Artifact Workflow with LLM', () => {
    it('should execute complete workflow: LLM → tool call → artifact storage → artifact reuse', async () => {
      // Step 1: LLM generates tool call for creating a server file
      const initialTask = {
        description: 'Create a simple Express.js server file'
      };

      context.conversationHistory.push({
        role: 'user',
        content: 'Create a simple Express.js server file',
        timestamp: Date.now()
      });

      const initialPrompt = strategy.buildPrompt(initialTask, context);
      const initialResponse = await llmClient.request({
        prompt: initialPrompt,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Parse and execute first tool call
      const jsonMatch1 = initialResponse.content.match(/\{[\s\S]*\}/);
      expect(jsonMatch1).toBeTruthy();
      const toolCall1 = JSON.parse(jsonMatch1[0]);

      await strategy.executeToolWithArtifacts(toolCall1, context);

      // Verify artifact was created
      const artifacts = context.listArtifacts();
      expect(artifacts.length).toBeGreaterThan(0);
      
      const firstArtifact = artifacts[0];
      expect(firstArtifact[1].type).toBeDefined();
      expect(firstArtifact[1].description).toBeDefined();

      // Add to conversation history
      context.conversationHistory.push({
        role: 'assistant',
        content: `Created server file and stored as @${firstArtifact[0]}`,
        timestamp: Date.now()
      });

      // Step 2: LLM generates second tool call that uses the first artifact
      const followupTask = {
        description: 'Read the server file content and then start the server'
      };

      context.conversationHistory.push({
        role: 'user',
        content: 'Now read the server file and start the server',
        timestamp: Date.now()
      });

      const followupPrompt = strategy.buildPrompt(followupTask, context);
      const followupResponse = await llmClient.request({
        prompt: followupPrompt,
        maxTokens: 2000,
        temperature: 0.1
      });

      // Parse second tool call
      const jsonMatch2 = followupResponse.content.match(/\{[\s\S]*\}/);
      expect(jsonMatch2).toBeTruthy();
      const toolCall2 = JSON.parse(jsonMatch2[0]);

      // Check if second tool call references the first artifact
      const inputsStr = JSON.stringify(toolCall2.inputs);
      const referencesArtifact = inputsStr.includes('@') && 
                                inputsStr.includes(firstArtifact[0]);

      if (referencesArtifact) {
        // Execute second tool call
        await strategy.executeToolWithArtifacts(toolCall2, context);

        // Verify we now have multiple artifacts
        const finalArtifacts = context.listArtifacts();
        expect(finalArtifacts.length).toBeGreaterThan(1);

        // Verify tools were called with resolved artifact values
        expect(mockFileWriteTool.execute).toHaveBeenCalled();
        
        // Check if file_read was called with resolved path
        if (toolCall2.tool === 'file_read') {
          expect(mockFileReadTool.execute).toHaveBeenCalled();
          const readCallArgs = mockFileReadTool.execute.mock.calls[0][0];
          expect(readCallArgs.filepath).toBeDefined();
          expect(typeof readCallArgs.filepath).toBe('string');
        }
      }
    }, 45000); // 45 second timeout for multiple LLM calls

    it('should handle artifact chaining across multiple LLM interactions', async () => {
      // Create initial configuration artifact
      context.addArtifact('initial_config', {
        type: 'data',
        value: { port: 3000, env: 'development' },
        description: 'Initial server configuration',
        purpose: 'Base configuration for server setup',
        timestamp: Date.now()
      });

      const steps = [
        {
          description: 'Create a server file using the initial configuration',
          expectedTool: 'file_write'
        },
        {
          description: 'Read the server file content for validation',
          expectedTool: 'file_read'
        },
        {
          description: 'Start the server using the created file',
          expectedTool: 'start_server'
        }
      ];

      let stepResults = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Add user message
        context.conversationHistory.push({
          role: 'user',
          content: step.description,
          timestamp: Date.now()
        });

        // Get LLM response
        const prompt = strategy.buildPrompt({ description: step.description }, context);
        const response = await llmClient.request({
          prompt: prompt,
          maxTokens: 2000,
          temperature: 0.1
        });

        // Parse and execute tool call
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const toolCall = JSON.parse(jsonMatch[0]);
          
          // Execute tool
          await strategy.executeToolWithArtifacts(toolCall, context);
          
          stepResults.push({
            step: i,
            toolCall: toolCall,
            artifactCount: context.listArtifacts().length
          });

          // Add assistant response
          const outputNames = toolCall.outputs?.map(o => `@${o.name}`).join(', ') || 'result';
          context.conversationHistory.push({
            role: 'assistant',
            content: `Executed ${toolCall.tool} and stored output as ${outputNames}`,
            timestamp: Date.now()
          });
        }
      }

      // Verify progressive artifact accumulation
      expect(stepResults.length).toBe(steps.length);
      for (let i = 0; i < stepResults.length; i++) {
        expect(stepResults[i].artifactCount).toBeGreaterThanOrEqual(i + 2); // +1 for initial_config, +1 for each step
      }

      // Verify all tools were called
      expect(mockFileWriteTool.execute).toHaveBeenCalled();
      expect(mockFileReadTool.execute).toHaveBeenCalled();
      expect(mockServerStartTool.execute).toHaveBeenCalled();
    }, 60000); // 60 second timeout for multiple sequential LLM calls
  });

  describe('LLM Artifact Naming and Descriptions', () => {
    it('should validate LLM generates meaningful artifact names and descriptions', async () => {
      const task = {
        description: 'Create a comprehensive web server with configuration, logging, and error handling'
      };

      context.conversationHistory.push({
        role: 'user',
        content: 'Create a comprehensive web server setup',
        timestamp: Date.now()
      });

      const prompt = strategy.buildPrompt(task, context);
      const response = await llmClient.request({
        prompt: prompt,
        maxTokens: 2500,
        temperature: 0.1
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const toolCall = JSON.parse(jsonMatch[0]);

      // Validate artifact naming quality
      for (const output of toolCall.outputs) {
        // Name should be descriptive and not generic
        expect(output.name).toBeDefined();
        expect(output.name.length).toBeGreaterThan(3);
        expect(output.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/); // Valid identifier format
        
        // Description should be meaningful
        expect(output.description).toBeDefined();
        expect(output.description.length).toBeGreaterThan(10);
        expect(output.description).not.toBe(output.name);
        
        // Type should be appropriate
        expect(output.type).toBeDefined();
        expect(['file', 'data', 'config', 'process', 'log', 'error'].includes(output.type)).toBe(true);
        
        // Purpose should explain why the artifact is needed
        if (output.purpose) {
          expect(output.purpose.length).toBeGreaterThan(5);
          expect(output.purpose).not.toBe(output.description);
        }
      }
    }, 30000);

    it('should verify LLM understands artifact context and references', async () => {
      // Set up context with multiple related artifacts
      context.addArtifact('database_config', {
        type: 'config',
        value: { host: 'localhost', port: 5432, database: 'myapp' },
        description: 'Database connection configuration',
        purpose: 'Configure database connection for the server',
        timestamp: Date.now()
      });

      context.addArtifact('server_config', {
        type: 'config',
        value: { port: 8080, cors: true, logging: true },
        description: 'Server configuration settings',
        purpose: 'Configure Express server behavior',
        timestamp: Date.now()
      });

      context.addArtifact('middleware_config', {
        type: 'config',
        value: { helmet: true, compression: true, rateLimit: 100 },
        description: 'Middleware configuration',
        purpose: 'Configure security and performance middleware',
        timestamp: Date.now()
      });

      const task = {
        description: 'Create a complete server setup file that uses all the existing configurations'
      };

      context.conversationHistory.push({
        role: 'user',
        content: 'Create a server file that integrates all our configurations',
        timestamp: Date.now()
      });

      const prompt = strategy.buildPrompt(task, context);
      const response = await llmClient.request({
        prompt: prompt,
        maxTokens: 2500,
        temperature: 0.1
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();
      const toolCall = JSON.parse(jsonMatch[0]);

      // Verify LLM references multiple existing artifacts
      const inputsStr = JSON.stringify(toolCall.inputs);
      const configReferences = [
        inputsStr.includes('@database_config'),
        inputsStr.includes('@server_config'),
        inputsStr.includes('@middleware_config')
      ];

      const referencedCount = configReferences.filter(Boolean).length;
      expect(referencedCount).toBeGreaterThanOrEqual(2); // Should reference at least 2 configs

      // Execute and verify resolution works
      await strategy.executeToolWithArtifacts(toolCall, context);
      
      // Check that tools received resolved values (not artifact references)
      const toolCalls = mockFileWriteTool.execute.mock.calls;
      if (toolCalls.length > 0) {
        const lastCall = toolCalls[toolCalls.length - 1][0];
        const hasResolvedValues = Object.values(lastCall).some(value => 
          typeof value === 'object' && value !== null && 
          (value.port || value.host || value.database || value.cors)
        );
        expect(hasResolvedValues).toBe(true);
      }
    }, 35000);
  });

  describe('Error Handling with LLM Integration', () => {
    it('should handle LLM tool call with invalid artifact reference', async () => {
      const task = {
        description: 'Use a non-existent configuration to create a server'
      };

      // Simulate LLM generating tool call with bad artifact reference
      const invalidToolCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/test.js',
          content: 'console.log("test");',
          config: '@non_existent_artifact' // This artifact doesn't exist
        },
        outputs: [{
          name: 'test_file',
          type: 'file',
          description: 'Test file',
          purpose: 'Testing error handling'
        }]
      };

      // Should throw error during parameter resolution
      await expect(strategy.executeToolWithArtifacts(invalidToolCall, context))
        .rejects.toThrow('Artifact not found: @non_existent_artifact');

      // Verify no artifact was created due to error
      expect(context.listArtifacts()).toHaveLength(0);
    });

    it('should handle malformed LLM response gracefully', async () => {
      // This tests our parsing robustness, not LLM quality
      // In real scenarios, we might get partial or malformed JSON

      const malformedResponses = [
        '{"tool": "file_write", "inputs": {}, // missing closing brace',
        '{"tool": "file_write", "inputs": {}, "outputs": [{"name": "test"}]}', // missing required fields
        'Just plain text with no JSON',
        '{"tool": "unknown_tool", "inputs": {}, "outputs": []}'
      ];

      for (const malformedResponse of malformedResponses) {
        let errorThrown = false;
        try {
          const parsed = JSON.parse(malformedResponse);
          await strategy.executeToolWithArtifacts(parsed, context);
        } catch (error) {
          errorThrown = true;
          // Should be a meaningful error, not a system crash
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
        }
        
        if (!malformedResponse.includes('Just plain text')) {
          // For JSON parsing errors vs. execution errors
          expect(errorThrown).toBe(true);
        }
      }
    });
  });
});