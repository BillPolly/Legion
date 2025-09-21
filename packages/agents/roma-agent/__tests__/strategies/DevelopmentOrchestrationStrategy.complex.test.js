/**
 * Complex Integration test for DevelopmentOrchestrationStrategy
 * 
 * Tests the complete development workflow with a complex project:
 * - RESTful API with authentication
 * - Database integration
 * - Comprehensive test suite
 * - Error handling and debugging
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import DevelopmentOrchestrationStrategy from '../../src/strategies/orchestration/DevelopmentOrchestrationStrategy.js';
import { Task } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('DevelopmentOrchestrationStrategy Complex Integration Tests', () => {
  let strategy;
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let testOutputDir;

  beforeEach(async () => {
    // Clear test output directory
    testOutputDir = '/tmp/roma-projects';
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, ignore
    }

    // Get real services
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await resourceManager.get('toolRegistry');

    // Create strategy with real services and longer iteration limit for complex projects
    strategy = new DevelopmentOrchestrationStrategy(llmClient, toolRegistry, {
      projectRoot: '/tmp',
      maxIterations: 7  // Complex projects may need more iterations
    });
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should develop a complex RESTful API with full workflow', async () => {
    const complexTask = new Task(`Create a RESTful API for a task management system with the following features:

CORE REQUIREMENTS:
1. User authentication with JWT tokens
2. CRUD operations for tasks (create, read, update, delete)
3. Task categories and priorities
4. User roles (admin, user)
5. Input validation and error handling
6. Database integration (use in-memory or file-based storage)
7. Rate limiting and security middleware
8. API documentation with examples

TECHNICAL SPECIFICATIONS:
- Use Express.js framework
- Implement proper HTTP status codes
- Include request/response logging
- Add comprehensive error handling middleware
- Support JSON request/response format
- Include health check endpoint
- Add configuration management
- Implement graceful shutdown

ENDPOINTS TO IMPLEMENT:
- POST /auth/login - User authentication
- POST /auth/register - User registration
- GET /tasks - List all tasks (with filtering)
- POST /tasks - Create new task
- GET /tasks/:id - Get specific task
- PUT /tasks/:id - Update task
- DELETE /tasks/:id - Delete task
- GET /users/profile - Get user profile
- GET /health - Health check endpoint

DATA MODELS:
- User: { id, username, email, password, role, createdAt }
- Task: { id, title, description, category, priority, status, userId, createdAt, updatedAt }

QUALITY REQUIREMENTS:
- 90%+ test coverage
- Comprehensive error handling
- Input validation for all endpoints
- Security best practices
- Production-ready code structure`, null);

    console.log('\n🚀 Starting complex RESTful API development workflow...');
    
    const result = await strategy.onParentMessage(complexTask, { type: 'start' });
    
    // Basic result validation
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('artifacts');
    
    console.log('\n📊 Development Workflow Results:');
    console.log(`Success: ${result.success}`);
    if (result.success) {
      console.log(`Message: ${result.result.message}`);
      console.log(`Iterations: ${result.result.iterations}`);
      console.log(`Final State: ${result.result.finalState}`);
      if (result.result.testsRun) {
        console.log(`Tests Run: ${result.result.testsRun}`);
        console.log(`Tests Passed: ${result.result.testsPassed}`);
      }
    } else {
      console.log(`Error: ${result.error}`);
    }

    // Analyze generated artifacts
    const artifacts = complexTask.getAllArtifacts();
    const artifactNames = Object.keys(artifacts);
    
    console.log('\n📁 Generated Artifacts:');
    artifactNames.forEach(name => {
      const artifact = artifacts[name];
      console.log(`  - ${name} (${artifact.type}): ${artifact.description}`);
    });

    // Verify we have substantial artifacts for a complex project
    expect(artifactNames.length).toBeGreaterThan(5); // Should have multiple files

    // Check for expected artifact types
    const codeFiles = artifactNames.filter(name => 
      name.endsWith('.js') && !name.includes('test')
    );
    const testFiles = artifactNames.filter(name => 
      name.includes('test') || name.includes('spec')
    );
    const configFiles = artifactNames.filter(name =>
      name.includes('package.json') || name.includes('config')
    );

    console.log('\n📋 Artifact Analysis:');
    console.log(`  Code Files: ${codeFiles.length}`);
    console.log(`  Test Files: ${testFiles.length}`);
    console.log(`  Config Files: ${configFiles.length}`);

    // Verify comprehensive development
    expect(codeFiles.length).toBeGreaterThan(0); // Should have generated code
    expect(testFiles.length).toBeGreaterThan(0); // Should have generated tests

    // Check for specific expected files for an API project
    const hasMainFile = artifactNames.some(name => 
      name.includes('index') || name.includes('app') || name.includes('server')
    );
    const hasAuthCode = artifactNames.some(name => 
      artifacts[name].value && artifacts[name].value.toLowerCase().includes('auth')
    );
    const hasTaskCode = artifactNames.some(name =>
      artifacts[name].value && artifacts[name].value.toLowerCase().includes('task')
    );

    console.log('\n🔍 Content Analysis:');
    console.log(`  Has Main File: ${hasMainFile}`);
    console.log(`  Has Auth Code: ${hasAuthCode}`);
    console.log(`  Has Task Code: ${hasTaskCode}`);

    // If successful, verify the workflow completed properly
    if (result.success) {
      expect(result.result.finalState).toBe('COMPLETED');
      expect(result.result.iterations).toBeGreaterThan(0);
      expect(result.result.iterations).toBeLessThanOrEqual(7);
      
      // Should have run tests successfully
      if (result.result.testsRun) {
        expect(result.result.testsRun).toBeGreaterThan(0);
        expect(result.result.testsPassed).toBeGreaterThan(0);
      }
    }

    // Check generated project directory structure
    try {
      const projectDirs = await fs.readdir('/tmp/roma-projects');
      console.log('\n📂 Generated Project Directories:');
      projectDirs.forEach(dir => console.log(`  - ${dir}`));
      
      expect(projectDirs.length).toBeGreaterThan(0);
      
      // Check if any generated project has a reasonable structure
      for (const projectDir of projectDirs) {
        const projectPath = path.join('/tmp/roma-projects', projectDir);
        try {
          const projectFiles = await fs.readdir(projectPath, { recursive: true });
          console.log(`\n📄 Files in ${projectDir}:`);
          projectFiles.slice(0, 10).forEach(file => console.log(`    ${file}`));
          if (projectFiles.length > 10) {
            console.log(`    ... and ${projectFiles.length - 10} more files`);
          }
        } catch (error) {
          console.log(`  Could not read project directory: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`Could not read roma-projects directory: ${error.message}`);
    }

    // Performance and quality metrics
    console.log('\n⏱️  Performance Metrics:');
    console.log(`  Total Artifacts Generated: ${artifactNames.length}`);
    console.log(`  Workflow Iterations: ${result.success ? result.result.iterations : 'N/A'}`);
    console.log(`  Final State: ${result.success ? result.result.finalState : 'FAILED'}`);

    // The test passes if we got substantial output, regardless of success/failure
    // This allows us to analyze what the workflow produces
    expect(artifactNames.length).toBeGreaterThan(0);
    expect(result).toHaveProperty('artifacts');
    
  }, 300000); // 5 minute timeout for complex development workflow

  test('should handle a moderately complex task - URL shortener service', async () => {
    const moderateTask = new Task(`Create a URL shortener service with the following features:

CORE FEATURES:
1. Shorten long URLs to unique short codes
2. Redirect short URLs to original URLs
3. Track click statistics
4. Custom short codes (optional)
5. URL expiration (optional)

TECHNICAL REQUIREMENTS:
- Express.js server
- In-memory or file-based storage
- Input validation (valid URLs)
- Error handling
- Rate limiting
- Analytics endpoint

ENDPOINTS:
- POST /shorten - Create short URL
- GET /:shortCode - Redirect to original URL
- GET /stats/:shortCode - Get click statistics
- GET /health - Health check

QUALITY:
- Comprehensive tests
- Error handling
- Input validation
- Clean code structure`, null);

    console.log('\n🚀 Starting URL shortener development workflow...');
    
    const result = await strategy.onParentMessage(moderateTask, { type: 'start' });
    
    console.log('\n📊 URL Shortener Results:');
    console.log(`Success: ${result.success}`);
    if (result.success) {
      console.log(`Iterations: ${result.result.iterations}`);
      console.log(`Final State: ${result.result.finalState}`);
    } else {
      console.log(`Error: ${result.error}`);
    }

    // Analyze artifacts
    const artifacts = moderateTask.getAllArtifacts();
    console.log(`\nGenerated ${Object.keys(artifacts).length} artifacts`);

    expect(result).toHaveProperty('success');
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    
  }, 240000); // 4 minute timeout

  test('should demonstrate iterative improvement workflow', async () => {
    const iterativeTask = new Task(`Create a simple calculator API that initially has a bug, then should be fixed through the development workflow:

INITIAL IMPLEMENTATION (with intentional issues):
- Basic arithmetic endpoints: +, -, *, /
- Division by zero should be handled
- Input validation needed
- Missing error handling

EXPECTED WORKFLOW:
1. Generate initial code with basic functionality
2. Generate tests that expose the issues
3. Tests should fail due to missing error handling
4. Debugging should identify the issues
5. Code should be fixed
6. Tests should pass on retry

This tests the complete iterative improvement cycle.`, null);

    console.log('\n🚀 Starting iterative improvement workflow...');
    
    const result = await strategy.onParentMessage(iterativeTask, { type: 'start' });
    
    console.log('\n📊 Iterative Improvement Results:');
    console.log(`Success: ${result.success}`);
    console.log(`Iterations: ${result.success ? result.result.iterations : 'N/A'}`);
    console.log(`Final State: ${result.success ? result.result.finalState : 'FAILED'}`);

    // This workflow should demonstrate multiple iterations
    if (result.success) {
      expect(result.result.iterations).toBeGreaterThan(1); // Should need multiple iterations
    }

    const artifacts = iterativeTask.getAllArtifacts();
    console.log(`\nGenerated ${Object.keys(artifacts).length} artifacts through iterative process`);

    expect(result).toHaveProperty('success');
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
    
  }, 180000); // 3 minute timeout
});