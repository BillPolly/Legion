/**
 * Integration test for ProjectContextService
 * NO MOCKS - uses real file system and project detection
 */

import ProjectContextService from '../../src/services/ProjectContextService.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ProjectContextService Integration', () => {
  let service;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    service = new ProjectContextService(resourceManager, null);
    
    // Create test project directory
    testDir = path.join(os.tmpdir(), `project-context-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should detect Node.js project type', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'jest',
        build: 'webpack'
      }
    };
    
    await fs.writeFile(
      path.join(testDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );

    const context = await service.getProjectTypeContext(testDir);
    
    expect(context).toContain('Node.js project');
    expect(context).toContain('test-project');
    expect(context).toContain('test, build');
  });

  test('should build directory structure context', async () => {
    // Create project structure
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'tests'));
    await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'console.log("main");');
    await fs.writeFile(path.join(testDir, 'tests', 'test.js'), 'test("works", () => {});');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project');

    const context = await service.getDirectoryContext(testDir);
    
    expect(context).toContain('Current Working Directory');
    expect(context).toContain(testDir);
    expect(context).toContain('Project Structure:');
    expect(context).toContain('src/');
    expect(context).toContain('tests/');
  });

  test('should provide environment context', () => {
    const context = service.getEnvironmentContext();
    
    expect(context).toContain('Environment Context');
    expect(context).toContain('Date:');
    expect(context).toContain('Platform:');
    expect(context).toContain('Node.js:');
    expect(context).toContain(process.platform);
    expect(context).toContain(process.version);
  });

  test('should detect git repository', async () => {
    // Create fake .git directory
    await fs.mkdir(path.join(testDir, '.git'));
    
    const isGit = await service.isGitRepository(testDir);
    expect(isGit).toBe(true);
    
    const gitContext = await service.getGitContext(testDir);
    expect(gitContext).toContain('Git Repository');
    expect(gitContext).toContain('git status');
    expect(gitContext).toContain('commit');
  });

  test('should build complete project context', async () => {
    const completeContext = await service.buildCompleteContext(testDir);
    
    expect(completeContext).toContain('Current Working Directory');
    expect(completeContext).toContain('Environment Context');
    expect(completeContext).toContain('Git Repository');
    expect(completeContext).toContain('Project Type');
    expect(completeContext).toContain('Node.js project');
    
    console.log('Complete context preview:', completeContext.substring(0, 300));
  });

  test('should handle directory that does not exist gracefully', async () => {
    const context = await service.getDirectoryContext('/nonexistent/directory');
    
    expect(context).toContain('Current Working Directory');
    expect(context).toContain('/nonexistent/directory');
    expect(context).toContain('❌ Cannot access directory');
  });

  test('should limit directory traversal depth', async () => {
    // Create deep nested structure
    await fs.mkdir(path.join(testDir, 'deep'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'deep', 'nested'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'deep', 'nested', 'very'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'deep', 'nested', 'very', 'deep.txt'), 'deep file');

    const structure = await service.getFolderStructure(testDir, 2);
    
    // Should include some structure but not go too deep
    expect(structure).toContain('deep/');
    expect(structure.length).toBeLessThan(1000); // Reasonable size limit
  });
});