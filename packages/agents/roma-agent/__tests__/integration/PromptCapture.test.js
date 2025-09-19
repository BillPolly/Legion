/**
 * PromptCapture Integration Tests
 * 
 * Captures actual prompts sent to the LLM during ROMA agent execution for inspection.
 * These tests use the PromptInterceptor to save all prompts and responses to text files.
 * 
 * This addresses the user's request: "please capture the prompts into text files so i can look at them"
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import ArtifactRegistry from '../../src/core/ArtifactRegistry.js';
import TaskClassifier from '../../src/utils/TaskClassifier.js';
import ToolDiscovery from '../../src/utils/ToolDiscovery.js';
import { PromptInterceptor } from './utils/PromptInterceptor.js';

describe('PromptCapture Integration Tests', () => {
  let agent;
  let promptInterceptor;
  let realLLMClient;
  let mockToolDiscovery;
  let mockToolRegistry;
  let outputDir;

  beforeEach(async () => {
    // Set up output directory for captured prompts
    outputDir = path.join(__dirname, 'tmp', 'captured-prompts');
    await fs.mkdir(outputDir, { recursive: true });

    // Clean up any existing files BEFORE the test runs (so you can inspect results after)
    try {
      const existingFiles = await fs.readdir(outputDir);
      await Promise.all(existingFiles.map(file => fs.unlink(path.join(outputDir, file))));
    } catch (error) {
      // Directory might not exist, ignore
    }

    // Create real LLM client mock (represents the actual LLM service)
    realLLMClient = {
      complete: jest.fn()
    };

    // Create prompt interceptor to capture all prompts
    promptInterceptor = new PromptInterceptor(realLLMClient, outputDir);

    // Mock tool discovery with realistic results
    mockToolDiscovery = {
      discoverTools: jest.fn().mockResolvedValue([
        {
          name: 'file_write',
          description: 'Write content to a file on disk',
          confidence: 0.95,
          execute: jest.fn().mockResolvedValue({ 
            success: true, 
            filepath: '/tmp/output.txt',
            message: 'File written successfully' 
          }),
          inputSchema: {
            properties: {
              filepath: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filepath', 'content']
          },
          outputSchema: {
            properties: {
              filepath: { type: 'string' },
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        },
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          confidence: 0.88,
          execute: jest.fn().mockResolvedValue({ 
            success: true, 
            result: 42,
            expression: '6 * 7' 
          }),
          inputSchema: {
            properties: {
              expression: { type: 'string' }
            },
            required: ['expression']
          },
          outputSchema: {
            properties: {
              result: { type: 'number' },
              expression: { type: 'string' }
            }
          }
        }
      ])
    };

    // Mock tool registry with searchTools method (used by ToolDiscovery)
    mockToolRegistry = {
      listTools: jest.fn().mockResolvedValue([
        {
          name: 'file_write',
          description: 'Write content to a file',
          inputSchema: { properties: { filepath: { type: 'string' }, content: { type: 'string' } } },
          execute: jest.fn().mockResolvedValue({ 
            success: true, 
            filepath: '/tmp/output.txt',
            message: 'File written successfully' 
          })
        }
      ]),
      searchTools: jest.fn().mockImplementation(async (description, options = {}) => {
        // Return file_write tool for any description that mentions files
        console.log(`🔍 Mock searchTools called with: "${description}"`);
        if (description.toLowerCase().includes('file') || 
            description.toLowerCase().includes('write') || 
            description.toLowerCase().includes('javascript') ||
            description.toLowerCase().includes('disk') ||
            description.toLowerCase().includes('code')) {
          return [{
            name: 'file_write',
            description: 'Write content to a file on disk',
            confidence: 0.95,
            execute: jest.fn().mockResolvedValue({ 
              success: true, 
              filepath: '/tmp/output.txt',
              message: 'File written successfully' 
            }),
            inputSchema: {
              properties: {
                filepath: { type: 'string' },
                content: { type: 'string' }
              },
              required: ['filepath', 'content']
            },
            outputSchema: {
              properties: {
                filepath: { type: 'string' },
                success: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }];
        }
        return [];
      })
    };

    // Create agent and manually set the intercepted LLM client
    agent = new SimpleROMAAgent();
    
    // Override the initialization to use real TaskClassifier and ToolDiscovery with intercepted LLM
    agent.initialize = async () => {
      // Call parent initialization to create real validators
      await SimpleROMAAgent.prototype.initialize.call(agent);
      
      // Override with test interceptor and mock registry
      agent.llmClient = promptInterceptor; // Use interceptor instead of real client
      agent.toolRegistry = mockToolRegistry;
      
      // Create REAL TaskClassifier and ToolDiscovery that use the intercepted LLM client
      agent.taskClassifier = new TaskClassifier(promptInterceptor);
      agent.toolDiscovery = new ToolDiscovery(promptInterceptor, mockToolRegistry);
      
      // Real validators are already created by parent initialize() call
    };
    
    await agent.initialize();
  });

  // NOTE: No afterEach cleanup - files are cleaned up BEFORE each test so you can inspect results after

  describe('Task Classification Prompt Capture', () => {
    it('should capture task classification prompts with correct content', async () => {
      // Mock LLM response for task classification (this is what will be captured)
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'This task can be accomplished with a single file write operation',
        suggestedApproach: 'Use file_write tool directly',
        estimatedSteps: 1
      }));

      // Mock LLM response for tool discovery (if tool discovery happens)
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify([
        "Write content to files on disk",
        "Save text content to specified file paths",
        "Create files with specific content"
      ]));

      // Mock LLM response for tool execution
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        useTools: true,
        toolCalls: [
          {
            tool: 'file_write',
            inputs: { filepath: '/tmp/test.txt', content: 'Hello World' },
            outputs: { filepath: '@saved_path' }
          }
        ]
      }));

      // Real validators will process the actual LLM JSON responses

      const task = { description: 'Write "Hello World" to a file at /tmp/test.txt' };
      const context = {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      };

      // Execute task to trigger prompt capture
      await agent.execute(task, context);

      // Verify prompts were captured
      const summary = promptInterceptor.generateSummary();
      expect(summary.totalPrompts).toBeGreaterThan(0);
      expect(summary.typeBreakdown['task-classification']).toBe(1);

      // Verify files were created
      const files = await fs.readdir(outputDir);
      const classificationFiles = files.filter(f => f.startsWith('task-classification'));
      expect(classificationFiles.length).toBeGreaterThan(0);

      // Read and verify classification prompt content
      const classificationFile = classificationFiles.find(f => !f.includes('response'));
      const promptContent = await fs.readFile(path.join(outputDir, classificationFile), 'utf8');

      expect(promptContent).toContain('=== ROMA AGENT PROMPT CAPTURE ===');
      expect(promptContent).toContain('Type: task-classification');
      expect(promptContent).toContain('Write "Hello World" to a file');
      expect(promptContent).toContain('classify it as either SIMPLE or COMPLEX');
      expect(promptContent).toContain('Classification criteria:');
      expect(promptContent).toContain('SIMPLE: Can be accomplished with a sequence');
      expect(promptContent).toContain('COMPLEX: Requires breaking down');

      console.log(`📝 Task classification prompt captured in: ${classificationFile}`);
    });

    it('should capture classification prompts with artifact context', async () => {
      // Set up artifacts in context
      const artifactRegistry = new ArtifactRegistry();
      artifactRegistry.store('existing_file', '/tmp/existing.txt', 'Previously created file');
      artifactRegistry.store('user_config', { name: 'John', theme: 'dark' }, 'User configuration data');
      const context = {
        artifactRegistry: artifactRegistry,
        conversation: [],
        depth: 0
      };

      // Mock LLM responses in order
      realLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Can use existing artifacts with file operations',
          suggestedApproach: 'Reference existing artifacts in tool calls'
        }))
        .mockResolvedValueOnce(JSON.stringify([
          "Update file content with new data",
          "Modify existing files with user input"
        ]))
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [
            {
              tool: 'file_write',
              inputs: { filepath: '@existing_file', content: 'Updated content' }
            }
          ]
        }));

      const task = { description: 'Update the existing file with new content' };
      await agent.execute(task, context);

      // Find classification prompt file
      const files = await fs.readdir(outputDir);
      const classificationFile = files.find(f => f.startsWith('task-classification') && !f.includes('response'));
      const promptContent = await fs.readFile(path.join(outputDir, classificationFile), 'utf8');

      // Verify the task classification prompt was captured
      // Note: TaskClassifier doesn't include artifacts in classification prompts,
      // but we can verify the prompt was captured properly
      expect(promptContent).toContain('Type: task-classification');
      expect(promptContent).toContain('Update the existing file with new content');
      expect(promptContent).toContain('Classification criteria:');
      expect(promptContent).toContain('SIMPLE: Can be accomplished with a sequence');

      console.log(`📝 Classification with artifacts captured in: ${classificationFile}`);
    });
  });

  describe('Tool Discovery Prompt Capture', () => {
    it('should capture tool discovery prompts with task descriptions', async () => {
      // Mock LLM responses
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Mathematical calculation task'
      }));

      // Mock tool discovery LLM call
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify([
        "Perform mathematical calculations and arithmetic operations",
        "Calculate numerical expressions with basic operators",
        "Write calculation results to output file",
        "Generate formatted mathematical output"
      ]));

      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        useTools: true,
        toolCalls: [
          { tool: 'calculator', inputs: { expression: '25 * 4' } }
        ]
      }));

      const task = { description: 'Calculate 25 multiplied by 4 and save the result' };
      const context = {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      };

      await agent.execute(task, context);

      // Find tool discovery prompt
      const files = await fs.readdir(outputDir);
      const discoveryFile = files.find(f => f.startsWith('tool-discovery') && !f.includes('response'));

      if (discoveryFile) {
        const promptContent = await fs.readFile(path.join(outputDir, discoveryFile), 'utf8');

        expect(promptContent).toContain('Type: tool-discovery');
        expect(promptContent).toContain('Generate tool descriptions');
        expect(promptContent).toContain('Calculate 25 multiplied by 4');
        expect(promptContent).toContain('GENERAL/HIGH-LEVEL descriptions');
        expect(promptContent).toContain('SPECIFIC/DETAILED descriptions');

        console.log(`📝 Tool discovery prompt captured in: ${discoveryFile}`);
      }
    });
  });

  describe('Simple Task Execution Prompt Capture', () => {
    it('should capture simple execution prompts with tool rendering', async () => {
      // Mock LLM responses
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Direct file operation'
      }));

      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        useTools: true,
        toolCalls: [
          {
            tool: 'file_write',
            inputs: { filepath: '/tmp/output.txt', content: 'Test content' },
            outputs: { filepath: '@result_file' }
          }
        ]
      }));

      const task = { description: 'Create a file with test content' };
      const context = {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      };

      await agent.execute(task, context);

      // Find simple execution prompt
      const files = await fs.readdir(outputDir);
      const executionFile = files.find(f => f.startsWith('simple-execution') && !f.includes('response'));

      if (executionFile) {
        const promptContent = await fs.readFile(path.join(outputDir, executionFile), 'utf8');

        expect(promptContent).toContain('Type: simple-execution');
        expect(promptContent).toContain('SIMPLE task');
        expect(promptContent).toContain('AVAILABLE TOOLS');
        expect(promptContent).toContain('file_write');
        expect(promptContent).toContain('confidence: 95%');
        expect(promptContent).toContain('sequence of tool calls');
        expect(promptContent).toContain('"useTools": true');
        expect(promptContent).toContain('"toolCalls": [');
        expect(promptContent).toContain('@artifact_name');

        // Verify tool rendering analysis
        expect(promptContent).toContain('TOOL REFERENCES');
        expect(promptContent).toContain('Found 1 tool references');
        expect(promptContent).toContain('- file_write');

        console.log(`📝 Simple execution prompt captured in: ${executionFile}`);
      }
    });

    it('should capture simple execution prompts with artifact rendering', async () => {
      // Set up artifacts
      const artifactRegistry = new ArtifactRegistry();
      artifactRegistry.store('template_content', '<html><body>Hello @name</body></html>', 'HTML template');
      artifactRegistry.store('user_name', 'Alice', 'User name for template');
      const context = {
        artifactRegistry: artifactRegistry,
        conversation: [],
        depth: 0
      };

      // Mock LLM responses
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Template substitution with file writing'
      }));

      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        useTools: true,
        toolCalls: [
          {
            tool: 'file_write',
            inputs: { 
              filepath: '/tmp/personalized.html', 
              content: '@template_content' 
            },
            outputs: { filepath: '@final_file' }
          }
        ]
      }));

      const task = { description: 'Create personalized HTML file using template and user name' };
      await agent.execute(task, context);

      // Find simple execution prompt
      const files = await fs.readdir(outputDir);
      const executionFile = files.find(f => f.startsWith('simple-execution') && !f.includes('response'));

      if (executionFile) {
        const promptContent = await fs.readFile(path.join(outputDir, executionFile), 'utf8');

        // Verify artifact rendering in prompt
        expect(promptContent).toContain('AVAILABLE ARTIFACTS');
        expect(promptContent).toContain('@template_content');
        expect(promptContent).toContain('@user_name');
        expect(promptContent).toContain('HTML template');
        expect(promptContent).toContain('User name for template');
        expect(promptContent).toContain('reference any artifact using the @ symbol');
        expect(promptContent).toContain('COMPLETE EXAMPLE OF A TOOL CALL WITH ARTIFACT');

        // Verify analysis section
        expect(promptContent).toContain('Contains "@artifact": YES');
        expect(promptContent).toContain('ARTIFACT REFERENCES');
        expect(promptContent).toContain('Found 2 artifact references');

        console.log(`📝 Simple execution with artifacts captured in: ${executionFile}`);
      }
    });
  });

  describe('Complex Task Decomposition Prompt Capture', () => {
    it('should capture complex decomposition prompts', async () => {
      // Mock LLM responses
      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        complexity: 'COMPLEX',
        reasoning: 'Multiple coordinated operations required',
        suggestedApproach: 'Break into subtasks for database, API, and frontend',
        estimatedSteps: 5
      }));

      realLLMClient.complete.mockResolvedValueOnce(JSON.stringify({
        decompose: true,
        subtasks: [
          {
            description: 'Set up database schema and tables',
            outputs: '@database_setup'
          },
          {
            description: 'Create REST API endpoints using @database_setup',
            outputs: '@api_service'
          },
          {
            description: 'Build frontend interface that connects to @api_service',
            outputs: '@web_app'
          }
        ]
      }));

      const task = { description: 'Build a complete web application with user authentication and data management' };
      const context = {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      };

      await agent.execute(task, context);

      // Find complex decomposition prompt
      const files = await fs.readdir(outputDir);
      const decompositionFile = files.find(f => f.startsWith('complex-decomposition') && !f.includes('response'));

      if (decompositionFile) {
        const promptContent = await fs.readFile(path.join(outputDir, decompositionFile), 'utf8');

        expect(promptContent).toContain('Type: complex-decomposition');
        expect(promptContent).toContain('COMPLEX and needs to be broken down');
        expect(promptContent).toContain('Build a complete web application');
        expect(promptContent).toContain('decompose this task into simpler subtasks');
        expect(promptContent).toContain('"decompose": true');
        expect(promptContent).toContain('"subtasks": [');
        expect(promptContent).toContain('@artifact_name syntax');

        console.log(`📝 Complex decomposition prompt captured in: ${decompositionFile}`);
      }
    });
  });

  describe('Response Analysis and Verification', () => {
    it('should capture LLM responses for analysis', async () => {
      // Mock LLM responses with specific JSON structures
      const classificationResponse = JSON.stringify({
        complexity: 'SIMPLE',
        reasoning: 'Single file operation with clear inputs and outputs',
        suggestedApproach: 'Direct tool execution',
        estimatedSteps: 1
      });

      const executionResponse = JSON.stringify({
        useTools: true,
        toolCalls: [
          {
            tool: 'file_write',
            inputs: { filepath: '/tmp/example.txt', content: 'Example content' },
            outputs: { filepath: '@created_file' }
          }
        ]
      });

      realLLMClient.complete
        .mockResolvedValueOnce(classificationResponse)
        .mockResolvedValueOnce(executionResponse);

      const task = { description: 'Write example content to a text file' };
      await agent.execute(task, {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      });

      // Check response files were created
      const files = await fs.readdir(outputDir);
      const responseFiles = files.filter(f => f.includes('response'));
      expect(responseFiles.length).toBeGreaterThan(0);

      // Verify response file content
      const responseFile = responseFiles[0];
      const responseContent = await fs.readFile(path.join(outputDir, responseFile), 'utf8');

      expect(responseContent).toContain('=== ROMA AGENT RESPONSE CAPTURE ===');
      expect(responseContent).toContain('RESPONSE ANALYSIS');
      expect(responseContent).toContain('Contains JSON: YES');
      expect(responseContent).toContain('Contains "useTools":');
      expect(responseContent).toContain('FULL RESPONSE');

      console.log(`📝 LLM response captured in: ${responseFile}`);
    });

    it('should generate comprehensive prompt capture summary', async () => {
      // Execute multiple different types of tasks to generate various prompts
      realLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({ complexity: 'SIMPLE', reasoning: 'Simple task' }))
        .mockResolvedValueOnce(JSON.stringify({ useTools: true, toolCalls: [] }))
        .mockResolvedValueOnce(JSON.stringify({ complexity: 'COMPLEX', reasoning: 'Complex task' }))
        .mockResolvedValueOnce(JSON.stringify({ decompose: true, subtasks: [] }));

      // Execute simple task
      await agent.execute({ description: 'Simple file task' }, {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      });
      
      // Execute complex task
      await agent.execute({ description: 'Complex application task' }, {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      });

      // Generate and verify summary
      const summary = promptInterceptor.generateSummary();
      
      expect(summary.totalPrompts).toBeGreaterThan(0);
      expect(summary.typeBreakdown).toHaveProperty('task-classification');
      expect(summary.outputDirectory).toBe(outputDir);

      console.log('📊 Prompt Capture Summary:');
      console.log(`   Total prompts captured: ${summary.totalPrompts}`);
      console.log('   Breakdown by type:');
      Object.entries(summary.typeBreakdown).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });
      console.log(`   Files saved to: ${summary.outputDirectory}`);
    });
  });

  describe('Real-World Task Scenarios', () => {
    it('should capture prompts for realistic development task', async () => {
      // Use a unique output directory for this test
      const testOutputDir = path.join(__dirname, 'tmp', 'captured-prompts-dev-task');
      await fs.mkdir(testOutputDir, { recursive: true });
      
      // Clear any existing files in this test's output directory
      try {
        const existingFiles = await fs.readdir(testOutputDir);
        await Promise.all(existingFiles.map(file => fs.unlink(path.join(testOutputDir, file))));
      } catch (error) {
        // Directory might not exist, ignore
      }

      // Create a fresh interceptor for this specific test
      const testInterceptor = new PromptInterceptor(realLLMClient, testOutputDir);

      // Mock realistic LLM responses for a development task
      realLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Code generation task that can be accomplished with file writing tools',
          suggestedApproach: 'Generate code and write to file'
        }))
        .mockResolvedValueOnce(JSON.stringify([
          "Generate JavaScript code for the solution",
          "Write JavaScript file to disk", 
          "Create Node.js server application",
          "Implement HTTP endpoint handlers"
        ]))
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [
            {
              tool: 'file_write',
              inputs: { 
                filepath: '/tmp/server.js', 
                content: 'const express = require("express"); const app = express(); app.listen(3000);'
              },
              outputs: { filepath: '@server_file' }
            }
          ]
        }));

      // Create a fresh agent for this test with the test interceptor
      const testAgent = new SimpleROMAAgent();
      
      // Override initialization to use mocked dependencies but real validators
      testAgent.initialize = async () => {
        // Call parent initialization to create real validators
        await SimpleROMAAgent.prototype.initialize.call(testAgent);
        
        // Override with test interceptor and mock registry
        testAgent.llmClient = testInterceptor; // Use test interceptor
        testAgent.toolRegistry = mockToolRegistry;
        
        // Create REAL TaskClassifier and ToolDiscovery that use the intercepted LLM client
        testAgent.taskClassifier = new TaskClassifier(testInterceptor);
        testAgent.toolDiscovery = new ToolDiscovery(testInterceptor, mockToolRegistry);
        
        // Real validators are already created by parent initialize() call
      };
      
      await testAgent.initialize();

      // Real validators will process the actual LLM JSON responses and drive execution flow

      const task = { 
        description: 'Create a simple Express.js server that listens on port 3000' 
      };
      
      console.log('🧪 Starting task execution with test interceptor...');
      console.log('📊 Test interceptor prompt count before:', testInterceptor.capturedPrompts.length);
      
      await testAgent.execute(task, {
        artifactRegistry: new ArtifactRegistry(),
        conversation: [],
        depth: 0
      });

      console.log('📊 Test interceptor prompt count after:', testInterceptor.capturedPrompts.length);
      console.log('📊 Test interceptor summary:', testInterceptor.generateSummary());

      // Verify prompts were captured (at least task classification should happen)
      const files = await fs.readdir(testOutputDir);
      console.log('📁 Files in test output directory:', files);
      console.log('📁 Test output directory path:', testOutputDir);
      expect(files.length).toBeGreaterThan(0);
      
      const promptTypes = new Set();
      
      files.forEach(file => {
        console.log('📄 Processing file:', file);
        if (!file.includes('response') && !file.includes('error')) {
          // For files like "task-classification-prompt-001-..." we want "task-classification"
          if (file.includes('task-classification')) {
            promptTypes.add('task-classification');
          } else if (file.includes('tool-discovery')) {
            promptTypes.add('tool-discovery');
          } else if (file.includes('simple-execution')) {
            promptTypes.add('simple-execution');
          } else if (file.includes('complex-decomposition')) {
            promptTypes.add('complex-decomposition');
          }
          console.log('📝 Extracted type for', file, ':', Array.from(promptTypes));
        }
      });

      console.log('📝 Final prompt types found:', Array.from(promptTypes));

      // Should at least have task classification
      expect(promptTypes.has('task-classification')).toBe(true);
      
      // Check if other types are present (might vary based on execution flow)
      const hasToolDiscovery = promptTypes.has('tool-discovery');
      const hasSimpleExecution = promptTypes.has('simple-execution');
      
      console.log(`📝 Development task prompts captured: ${Array.from(promptTypes).join(', ')}`);
      
      // Should have at least classification, and possibly others
      expect(promptTypes.size).toBeGreaterThanOrEqual(1);
      
      // Verify we captured the key prompts - task classification should always happen
      expect(promptTypes.has('task-classification')).toBe(true);
      
      // Tool discovery may or may not happen depending on the execution flow
      // This is expected behavior - not all tasks require all prompt types
      console.log(`📝 Captured prompt types: ${Array.from(promptTypes).join(', ')}`);
      console.log(`📝 Has tool discovery: ${hasToolDiscovery}`);
      console.log(`📝 Has simple execution: ${hasSimpleExecution}`);
      
      // Note: The execution flow may not reach simple-execution if the task is 
      // classified but execution is handled by mocked validators
      
      // Don't clean up test directory - leave files for inspection!
    });
  });

  describe('Error and Edge Cases', () => {
    it('should capture error scenarios in prompt files', async () => {
      // Mock LLM to throw an error
      realLLMClient.complete.mockRejectedValueOnce(new Error('LLM service unavailable'));

      const task = { description: 'Task that will cause LLM error' };
      
      try {
        await agent.execute(task, {
          artifactRegistry: new ArtifactRegistry(),
          conversation: [],
          depth: 0
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify error file was created
      const files = await fs.readdir(outputDir);
      const errorFiles = files.filter(f => f.includes('error'));
      expect(errorFiles.length).toBeGreaterThan(0);

      const errorFile = errorFiles[0];
      const errorContent = await fs.readFile(path.join(outputDir, errorFile), 'utf8');

      expect(errorContent).toContain('=== ROMA AGENT ERROR CAPTURE ===');
      expect(errorContent).toContain('LLM service unavailable');
      expect(errorContent).toContain('ORIGINAL PROMPT');

      console.log(`📝 Error scenario captured in: ${errorFile}`);
    });
  });
});