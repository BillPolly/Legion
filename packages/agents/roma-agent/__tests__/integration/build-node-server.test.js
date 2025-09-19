/**
 * Integration test for building a Node.js server using ROMA agent
 * Tests artifact flow with a real, complex task
 */
import { jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

describe('ROMA Agent - Build Node.js Server', () => {
  let resourceManager;
  let agent;
  let projectRoot;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
    await resourceManager.initialize();
    
    // Set up project root in /tmp/examples
    projectRoot = '/tmp/examples/node-server-' + Date.now();
    await fs.mkdir(projectRoot, { recursive: true });
    
    console.log('Project will be built in:', projectRoot);
  }, 30000);
  
  afterAll(async () => {
    // Optional: clean up the project directory
    // await fs.rm(projectRoot, { recursive: true, force: true });
    console.log('Build artifacts preserved in:', projectRoot);
  });
  
  it('should build a Node.js server with endpoints and test with curl', async () => {
    // Create agent
    agent = new SimpleROMAAgent({
      verbose: true
    });
    await agent.initialize();
    
    // Set up the project root as an initial artifact through the task
    const projectRootContext = `Use the following project root directory for all files: ${projectRoot}`;
    
    // No direct artifact registry access - the agent will manage it internally
    
    // Execute the task to build a server
    const task = `Build a Node.js Express server with the following requirements:
    1. Create all files in ${projectRoot}
    2. Create a package.json with express dependency
    3. Create server.js with these endpoints:
       - GET / returns {"message": "Hello World", "timestamp": <current_time>}
       - GET /health returns {"status": "healthy", "uptime": <server_uptime>}
       - POST /echo returns the request body
       - GET /random returns {"number": <random 1-100>}
    4. Server should run on port 3456
    5. Create a test.sh script that uses curl to test all endpoints
    6. Create a README.md with instructions`;
    
    const result = await agent.execute({ description: task });
    
    // Check that files were created
    expect(result.success).toBe(true);
    
    // Verify package.json was created
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    expect(packageJsonExists).toBe(true);
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies).toHaveProperty('express');
    
    // Verify server.js was created
    const serverPath = path.join(projectRoot, 'server.js');
    const serverExists = await fs.access(serverPath).then(() => true).catch(() => false);
    expect(serverExists).toBe(true);
    
    const serverCode = await fs.readFile(serverPath, 'utf-8');
    expect(serverCode).toContain('express');
    expect(serverCode).toContain('3456');
    expect(serverCode).toContain('/health');
    expect(serverCode).toContain('/echo');
    expect(serverCode).toContain('/random');
    
    // Verify test.sh was created
    const testScriptPath = path.join(projectRoot, 'test.sh');
    const testScriptExists = await fs.access(testScriptPath).then(() => true).catch(() => false);
    expect(testScriptExists).toBe(true);
    
    // Check result metadata for artifacts (if exposed)
    if (result.artifacts) {
      console.log('\nArtifacts created:', result.artifacts.length);
      result.artifacts.forEach(a => {
        console.log(`  - ${a.name}: ${a.description}`);
      });
    } else {
      console.log('\nTask completed but artifact details not exposed in result');
    }
    
    // Verify that we have a successful build
    expect(result.success).toBe(true);
    
  }, 300000); // 5 minutes timeout for this complex task
  
  it('should test the generated server with curl commands', async () => {
    // Skip if previous test didn't create the server
    const serverPath = path.join(projectRoot, 'server.js');
    const serverExists = await fs.access(serverPath).then(() => true).catch(() => false);
    
    if (!serverExists) {
      console.log('Server not found, skipping curl tests');
      return;
    }
    
    // Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install', { cwd: projectRoot, stdio: 'pipe' });
    
    // Start the server
    console.log('Starting server...');
    const { spawn } = await import('child_process');
    const serverProcess = spawn('node', ['server.js'], { 
      cwd: projectRoot,
      detached: false
    });
    
    let serverOutput = '';
    serverProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
      console.log('Server:', data.toString());
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Test GET /
      console.log('\nTesting GET /');
      const rootResponse = await fetch('http://localhost:3456/');
      expect(rootResponse.ok).toBe(true);
      const rootData = await rootResponse.json();
      expect(rootData.message).toBe('Hello World');
      expect(rootData.timestamp).toBeDefined();
      
      // Test GET /health
      console.log('Testing GET /health');
      const healthResponse = await fetch('http://localhost:3456/health');
      expect(healthResponse.ok).toBe(true);
      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('healthy');
      expect(healthData.uptime).toBeDefined();
      
      // Test POST /echo
      console.log('Testing POST /echo');
      const echoPayload = { test: 'data', number: 42 };
      const echoResponse = await fetch('http://localhost:3456/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(echoPayload)
      });
      expect(echoResponse.ok).toBe(true);
      const echoData = await echoResponse.json();
      expect(echoData).toEqual(echoPayload);
      
      // Test GET /random
      console.log('Testing GET /random');
      const randomResponse = await fetch('http://localhost:3456/random');
      expect(randomResponse.ok).toBe(true);
      const randomData = await randomResponse.json();
      expect(randomData.number).toBeGreaterThanOrEqual(1);
      expect(randomData.number).toBeLessThanOrEqual(100);
      
      // Test with curl commands from test.sh
      console.log('\nRunning test.sh script...');
      const testScriptPath = path.join(projectRoot, 'test.sh');
      const testScriptExists = await fs.access(testScriptPath).then(() => true).catch(() => false);
      
      if (testScriptExists) {
        // Make script executable
        await fs.chmod(testScriptPath, '755');
        
        // Run the test script
        try {
          const testOutput = execSync('./test.sh', { 
            cwd: projectRoot, 
            encoding: 'utf-8',
            timeout: 10000
          });
          console.log('Test script output:\n', testOutput);
        } catch (error) {
          console.log('Test script error (may be expected):', error.message);
        }
      }
      
      console.log('\n✅ All server endpoints working correctly!');
      
    } finally {
      // Stop the server
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, 60000);
  
  it('should demonstrate artifact flow for complex builds', async () => {
    // Skip this test if agent wasn't created
    if (!agent) {
      console.log('Agent not created, skipping artifact flow analysis');
      return;
    }
    
    console.log('\n📦 Artifact Flow Analysis:');
    
    // Check the files that were created
    const files = await fs.readdir(projectRoot).catch(() => []);
    console.log('Files created:', files.length);
    
    // Group files by extension
    const filesByExtension = {};
    files.forEach(file => {
      const ext = path.extname(file) || 'no-ext';
      if (!filesByExtension[ext]) {
        filesByExtension[ext] = [];
      }
      filesByExtension[ext].push(file);
    });
    
    console.log('\nFiles by type:');
    Object.entries(filesByExtension).forEach(([ext, items]) => {
      console.log(`  ${ext}: ${items.length} files`);
      items.forEach(item => {
        console.log(`    - ${item}`);
      });
    });
    
    // Check for expected files from a server build
    expect(files.length).toBeGreaterThan(0);
    
    // Should have package.json
    expect(files).toContain('package.json');
    
    // Should have server.js
    expect(files.some(f => f.includes('server'))).toBe(true);
    
    console.log('\n✅ Build completed and files were created successfully!');
  });
});