/**
 * End-to-End Artifact Lifecycle Tests
 * Tests complete artifact lifecycle with real tools, real LLM, and full system integration
 * 
 * This test suite validates the complete artifact management workflow:
 * - Real LLM generates tool calls with artifact specifications
 * - Real tools execute and produce actual outputs
 * - Artifacts are stored and managed correctly
 * - Artifacts are reused across multiple execution strategies
 * - Complete task decomposition and execution with artifact flow
 * - Error handling and recovery with artifacts
 * - Performance and scalability with large artifact sets
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RecursiveExecutionStrategy } from '../../src/core/strategies/RecursiveExecutionStrategy.js';
import { SequentialExecutionStrategy } from '../../src/core/strategies/SequentialExecutionStrategy.js';
import { AtomicExecutionStrategy } from '../../src/core/strategies/AtomicExecutionStrategy.js';
import { ExecutionContext } from '../../src/core/ExecutionContext.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools';
import fs from 'fs/promises';
import path from 'path';

describe('Artifact Lifecycle - End-to-End Tests', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  let testOutputDir;

  beforeEach(async () => {
    // Get real ResourceManager and dependencies
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();

    // Get real ToolRegistry with actual tools
    toolRegistry = await ToolRegistry.getInstance();
    expect(toolRegistry).toBeDefined();

    // Create test output directory
    testOutputDir = `/tmp/roma-agent-e2e-${Date.now()}`;
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Task Decomposition with Artifacts', () => {
    it('should execute full task: "Create Express server with tests" using real tools and LLM', async () => {
      const recursiveStrategy = new RecursiveExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });

      await recursiveStrategy.initialize();

      const rootContext = new ExecutionContext();
      rootContext.conversationHistory.push({
        role: 'user',
        content: 'Create a complete Express.js server with API endpoints and tests',
        timestamp: Date.now()
      });

      const task = {
        id: 'create-express-server',
        description: 'Create a complete Express.js server with a REST API for user management, including endpoints for CRUD operations and comprehensive tests',
        context: {
          outputDirectory: testOutputDir,
          serverPort: 3001,
          features: ['user-management', 'authentication', 'testing']
        }
      };

      // Execute the complete task
      const result = await recursiveStrategy.execute(task, rootContext);

      // Verify task completion
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify artifacts were created throughout the process
      const finalArtifacts = rootContext.listArtifacts();
      expect(finalArtifacts.length).toBeGreaterThan(0);

      // Check for expected artifact types
      const artifactTypes = finalArtifacts.map(([name, record]) => record.type);
      expect(artifactTypes).toContain('file'); // Should have created files
      
      // Verify conversation history was maintained
      expect(rootContext.conversationHistory.length).toBeGreaterThan(1);
      
      // Check that artifacts were properly referenced in conversation
      const conversationContent = rootContext.conversationHistory
        .map(msg => msg.content)
        .join(' ');
      expect(conversationContent).toMatch(/@\w+/); // Should contain artifact references

      console.log('✅ Full task decomposition completed with artifacts');
      console.log(`   Created ${finalArtifacts.length} artifacts`);
      console.log(`   Conversation history: ${rootContext.conversationHistory.length} messages`);
    }, 120000); // 2 minute timeout for full E2E test

    it('should handle complex multi-file project creation with artifact dependencies', async () => {
      const recursiveStrategy = new RecursiveExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });

      await recursiveStrategy.initialize();

      const rootContext = new ExecutionContext();
      rootContext.conversationHistory.push({
        role: 'user',
        content: 'Create a Node.js library with TypeScript, tests, and documentation',
        timestamp: Date.now()
      });

      const task = {
        id: 'create-nodejs-library',
        description: 'Create a complete Node.js library project with TypeScript configuration, source files, unit tests, integration tests, and README documentation',
        context: {
          projectName: 'test-utility-lib',
          outputDirectory: testOutputDir,
          features: ['typescript', 'jest-testing', 'documentation', 'npm-package']
        }
      };

      const result = await recursiveStrategy.execute(task, rootContext);

      expect(result.success).toBe(true);

      // Verify complex artifact ecosystem
      const artifacts = rootContext.listArtifacts();
      const fileArtifacts = artifacts.filter(([name, record]) => record.type === 'file');
      const configArtifacts = artifacts.filter(([name, record]) => record.type === 'config');
      const dataArtifacts = artifacts.filter(([name, record]) => record.type === 'data');

      expect(fileArtifacts.length).toBeGreaterThan(3); // Multiple files created
      expect(artifacts.length).toBeGreaterThan(5); // Comprehensive artifact set

      // Verify artifact relationships and dependencies
      const artifactsWithDeps = artifacts.filter(([name, record]) => 
        record.metadata?.inputArtifacts && record.metadata.inputArtifacts.length > 0
      );
      expect(artifactsWithDeps.length).toBeGreaterThan(0); // Should have dependent artifacts

      console.log('✅ Complex project creation completed');
      console.log(`   File artifacts: ${fileArtifacts.length}`);
      console.log(`   Config artifacts: ${configArtifacts.length}`);
      console.log(`   Data artifacts: ${dataArtifacts.length}`);
      console.log(`   Dependent artifacts: ${artifactsWithDeps.length}`);
    }, 180000); // 3 minute timeout for complex project
  });

  describe('Cross-Strategy Artifact Flow', () => {
    it('should pass artifacts between RecursiveExecutionStrategy and SequentialExecutionStrategy', async () => {
      // Step 1: Use RecursiveExecutionStrategy to decompose and create initial artifacts
      const recursiveStrategy = new RecursiveExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });
      await recursiveStrategy.initialize();

      const context = new ExecutionContext();
      context.conversationHistory.push({
        role: 'user',
        content: 'Set up project structure and configuration files',
        timestamp: Date.now()
      });

      const setupTask = {
        id: 'project-setup',
        description: 'Create project directory structure and configuration files for a web application',
        context: { outputDirectory: testOutputDir }
      };

      const setupResult = await recursiveStrategy.execute(setupTask, context);
      expect(setupResult.success).toBe(true);

      const initialArtifacts = context.listArtifacts();
      expect(initialArtifacts.length).toBeGreaterThan(0);

      console.log(`✅ RecursiveExecutionStrategy created ${initialArtifacts.length} artifacts`);

      // Step 2: Use SequentialExecutionStrategy to build upon the artifacts
      const sequentialStrategy = new SequentialExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });
      await sequentialStrategy.initialize();

      // Add conversation context about using existing artifacts
      context.conversationHistory.push({
        role: 'assistant',
        content: `Created project setup with artifacts: ${initialArtifacts.map(([name]) => `@${name}`).join(', ')}`,
        timestamp: Date.now()
      });

      context.conversationHistory.push({
        role: 'user',
        content: 'Now implement the application logic using the existing project structure',
        timestamp: Date.now()
      });

      const implementationTask = {
        id: 'implementation',
        description: 'Implement application logic, routes, and business logic using the existing project structure and configuration files',
        sequential: true,
        context: { 
          baseDirectory: testOutputDir,
          useExistingStructure: true
        }
      };

      const implementationResult = await sequentialStrategy.execute(implementationTask, context);
      expect(implementationResult).toBeDefined();

      const finalArtifacts = context.listArtifacts();
      expect(finalArtifacts.length).toBeGreaterThan(initialArtifacts.length);

      console.log(`✅ SequentialExecutionStrategy added ${finalArtifacts.length - initialArtifacts.length} more artifacts`);

      // Verify artifacts have proper dependencies
      const implementationArtifacts = finalArtifacts.slice(initialArtifacts.length);
      const artifactsWithDeps = implementationArtifacts.filter(([name, record]) => 
        record.metadata?.inputArtifacts && record.metadata.inputArtifacts.length > 0
      );

      expect(artifactsWithDeps.length).toBeGreaterThan(0); // Should reference initial artifacts

      console.log('✅ Cross-strategy artifact flow verified');
    }, 150000); // 2.5 minute timeout
  });

  describe('Error Handling and Recovery with Artifacts', () => {
    it('should handle tool failures gracefully and maintain artifact integrity', async () => {
      const atomicStrategy = new AtomicExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });
      await atomicStrategy.initialize();

      const context = new ExecutionContext();

      // Create initial artifacts
      context.addArtifact('config_file', {
        type: 'file',
        value: path.join(testOutputDir, 'config.json'),
        description: 'Application configuration file',
        purpose: 'Store application settings',
        timestamp: Date.now()
      });

      context.addArtifact('app_config', {
        type: 'data',
        value: { port: 3000, env: 'test', debug: true },
        description: 'Application configuration data',
        purpose: 'Configure application behavior',
        timestamp: Date.now()
      });

      const initialArtifactCount = context.listArtifacts().length;

      // Try to execute a task that might fail (invalid file operation)
      const riskyTask = {
        id: 'risky-operation',
        description: 'Perform an operation that might fail - create a file in a non-existent directory',
        tool: 'file_write',
        inputs: {
          filepath: '/invalid/path/that/does/not/exist/test.txt',
          content: 'This should fail'
        },
        outputs: [{
          name: 'failed_file',
          type: 'file',
          description: 'File that should fail to create',
          purpose: 'Test error handling'
        }]
      };

      // Execute the risky task
      let threwError = false;
      try {
        await atomicStrategy.execute(riskyTask, context);
      } catch (error) {
        threwError = true;
        expect(error.message).toBeDefined();
      }

      // In case the tool doesn't throw but returns failure result
      if (!threwError) {
        // Some tools might return error results instead of throwing
        console.log('Tool returned result instead of throwing');
      }

      // Verify existing artifacts were not corrupted
      const artifactsAfterFailure = context.listArtifacts();
      expect(artifactsAfterFailure.length).toBe(initialArtifactCount); // No new artifacts due to failure

      // Verify existing artifacts are still intact
      expect(context.getArtifactValue('config_file')).toBeDefined();
      expect(context.getArtifactValue('app_config')).toEqual({ port: 3000, env: 'test', debug: true });

      // Now execute a valid task to ensure the system can continue
      const recoveryTask = {
        id: 'recovery-operation',
        description: 'Perform a valid operation to test recovery',
        tool: 'file_write',
        inputs: {
          filepath: path.join(testOutputDir, 'recovery.txt'),
          content: 'Recovery successful'
        },
        outputs: [{
          name: 'recovery_file',
          type: 'file',
          description: 'Recovery test file',
          purpose: 'Verify system recovery'
        }]
      };

      const recoveryResult = await atomicStrategy.execute(recoveryTask, context);
      if (recoveryResult) {
        expect(recoveryResult.success).toBe(true);
      }

      const finalArtifacts = context.listArtifacts();
      expect(finalArtifacts.length).toBe(initialArtifactCount + 1); // One new artifact from recovery

      console.log('✅ Error handling and recovery verified');
    }, 60000);
  });

  describe('Artifact Performance and Scalability', () => {
    it('should handle large numbers of artifacts efficiently', async () => {
      const context = new ExecutionContext();
      const startTime = Date.now();

      // Create many artifacts to test scalability
      const artifactCount = 100;
      for (let i = 0; i < artifactCount; i++) {
        context.addArtifact(`artifact_${i}`, {
          type: 'data',
          value: { 
            id: i, 
            data: `test data ${i}`,
            metadata: { index: i, created: Date.now() }
          },
          description: `Test artifact number ${i}`,
          purpose: 'Performance testing',
          timestamp: Date.now()
        });
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Should create 100 artifacts quickly

      // Test retrieval performance
      const retrievalStart = Date.now();
      for (let i = 0; i < artifactCount; i++) {
        const artifact = context.getArtifactValue(`artifact_${i}`);
        expect(artifact.id).toBe(i);
      }
      const retrievalTime = Date.now() - retrievalStart;
      expect(retrievalTime).toBeLessThan(100); // Should retrieve all artifacts quickly

      // Test listing performance
      const listStart = Date.now();
      const allArtifacts = context.listArtifacts();
      const listTime = Date.now() - listStart;
      
      expect(allArtifacts.length).toBe(artifactCount);
      expect(listTime).toBeLessThan(50); // Should list all artifacts quickly

      // Test parameter resolution performance with many artifacts
      const recursiveStrategy = new RecursiveExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });

      const resolutionStart = Date.now();
      const testInputs = {
        config: '@artifact_0',
        data: '@artifact_50',
        reference: '@artifact_99'
      };

      const resolved = recursiveStrategy.resolveToolInputs(testInputs, context);
      const resolutionTime = Date.now() - resolutionStart;

      expect(resolved.config.id).toBe(0);
      expect(resolved.data.id).toBe(50);
      expect(resolved.reference.id).toBe(99);
      expect(resolutionTime).toBeLessThan(10); // Should resolve quickly even with many artifacts

      console.log('✅ Performance testing completed');
      console.log(`   Creation time for ${artifactCount} artifacts: ${creationTime}ms`);
      console.log(`   Retrieval time for ${artifactCount} lookups: ${retrievalTime}ms`);
      console.log(`   Listing time: ${listTime}ms`);
      console.log(`   Resolution time: ${resolutionTime}ms`);
    }, 30000);
  });

  describe('Real File System Operations with Artifacts', () => {
    it('should create, read, and modify real files using artifact references', async () => {
      const atomicStrategy = new AtomicExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });
      await atomicStrategy.initialize();

      const context = new ExecutionContext();

      // Step 1: Create a real file
      const createTask = {
        id: 'create-file',
        tool: 'file_write',
        inputs: {
          filepath: path.join(testOutputDir, 'test-config.json'),
          content: JSON.stringify({ 
            app: 'test-app',
            version: '1.0.0',
            port: 3000 
          }, null, 2)
        },
        outputs: [{
          name: 'config_file',
          type: 'file',
          description: 'Application configuration file',
          purpose: 'Store app configuration'
        }]
      };

      const createResult = await atomicStrategy.execute(createTask, context);
      if (createResult) {
        expect(createResult.success).toBe(true);
      }

      // Verify file was actually created
      const filePath = path.join(testOutputDir, 'test-config.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Step 2: Read the file using artifact reference
      const readTask = {
        id: 'read-file',
        tool: 'file_read',
        inputs: {
          filepath: '@config_file'  // Reference the artifact
        },
        outputs: [{
          name: 'config_data',
          type: 'data',
          description: 'Parsed configuration data',
          purpose: 'Application configuration object'
        }]
      };

      const readResult = await atomicStrategy.execute(readTask, context);
      if (readResult) {
        expect(readResult.success).toBe(true);
      }

      // Verify the content was read correctly
      const configData = context.getArtifactValue('config_data');
      expect(configData).toBeDefined();

      // Step 3: Modify configuration and write back
      const modifiedConfig = { 
        ...JSON.parse(configData.toString()),
        port: 8080,
        env: 'production'
      };

      const updateTask = {
        id: 'update-file',
        tool: 'file_write',
        inputs: {
          filepath: '@config_file',  // Reference the same file artifact
          content: JSON.stringify(modifiedConfig, null, 2)
        },
        outputs: [{
          name: 'updated_config_file',
          type: 'file',
          description: 'Updated configuration file',
          purpose: 'Store modified configuration'
        }]
      };

      const updateResult = await atomicStrategy.execute(updateTask, context);
      if (updateResult) {
        expect(updateResult.success).toBe(true);
      }

      // Verify the file was actually modified
      const updatedContent = await fs.readFile(filePath, 'utf-8');
      const parsedUpdated = JSON.parse(updatedContent);
      expect(parsedUpdated.port).toBe(8080);
      expect(parsedUpdated.env).toBe('production');
      expect(parsedUpdated.app).toBe('test-app'); // Original fields preserved

      // Verify artifact chain
      const artifacts = context.listArtifacts();
      expect(artifacts.length).toBe(3); // config_file, config_data, updated_config_file

      console.log('✅ Real file system operations with artifacts completed');
      console.log(`   Created and manipulated: ${filePath}`);
      console.log(`   Final artifact count: ${artifacts.length}`);
    }, 60000);
  });

  describe('Integration with Real Tool Registry', () => {
    it('should work with actual tool registry tools and real execution', async () => {
      const sequentialStrategy = new SequentialExecutionStrategy({
        toolRegistry,
        llmClient,
        resourceManager
      });
      await sequentialStrategy.initialize();

      const context = new ExecutionContext();

      // Create a multi-step task that uses real tools from the registry
      const task = {
        id: 'real-tool-workflow',
        sequential: true,
        steps: [
          {
            id: 'step-1',
            tool: 'directory_create',
            inputs: {
              path: path.join(testOutputDir, 'project')
            },
            outputs: [{
              name: 'project_dir',
              type: 'directory',
              description: 'Project root directory',
              purpose: 'Container for all project files'
            }]
          },
          {
            id: 'step-2',
            tool: 'file_write',
            inputs: {
              filepath: path.join(testOutputDir, 'project', 'package.json'),
              content: JSON.stringify({
                name: 'test-project',
                version: '1.0.0',
                description: 'Test project for E2E testing'
              }, null, 2)
            },
            outputs: [{
              name: 'package_json',
              type: 'file',
              description: 'NPM package configuration',
              purpose: 'Define project metadata and dependencies'
            }]
          },
          {
            id: 'step-3',
            tool: 'file_read',
            inputs: {
              filepath: '@package_json'  // Use artifact reference
            },
            outputs: [{
              name: 'package_data',
              type: 'data',
              description: 'Package.json content',
              purpose: 'Parsed package information'
            }]
          }
        ]
      };

      const result = await sequentialStrategy.execute(task, context);
      expect(result).toBeDefined();

      // Verify all steps created artifacts
      const artifacts = context.listArtifacts();
      expect(artifacts.length).toBeGreaterThanOrEqual(3);

      // Verify real directory was created
      const projectDir = path.join(testOutputDir, 'project');
      const dirExists = await fs.access(projectDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);

      // Verify real file was created and read
      const packageJsonPath = path.join(projectDir, 'package.json');
      const fileExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify artifact resolution worked
      const packageData = context.getArtifactValue('package_data');
      expect(packageData).toBeDefined();
      
      // Parse and verify content
      const parsedData = typeof packageData === 'string' ? JSON.parse(packageData) : packageData;
      expect(parsedData.name).toBe('test-project');

      console.log('✅ Real tool registry integration verified');
      console.log(`   Artifacts created: ${artifacts.length}`);
      console.log(`   Project directory: ${projectDir}`);
    }, 60000);
  });
});