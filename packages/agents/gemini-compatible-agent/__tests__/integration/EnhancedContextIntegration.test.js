/**
 * Integration tests for Enhanced ProjectContextService with file tracking
 * NO MOCKS - uses real file system and context tracking
 */

import ProjectContextService from '../../src/services/ProjectContextService.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Enhanced ProjectContextService Integration', () => {
  let service;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    service = new ProjectContextService(resourceManager, null);
    
    // Create test project directory
    testDir = path.join(os.tmpdir(), `enhanced-context-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should track file access and build recent files context', async () => {
    const file1 = path.join(testDir, 'tracked1.js');
    const file2 = path.join(testDir, 'tracked2.txt');
    
    // Create files
    await fs.writeFile(file1, 'console.log("test1");');
    await fs.writeFile(file2, 'test content');
    
    // Track file accesses
    service.trackFileAccess(file1, 'write');
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    service.trackFileAccess(file2, 'read');
    await new Promise(resolve => setTimeout(resolve, 10));
    service.trackFileAccess(file1, 'edit');
    
    // Get recent files context
    const recentContext = service.getRecentFilesContext();
    
    expect(recentContext).toContain('Recently Accessed Files');
    expect(recentContext).toContain('tracked1.js');
    expect(recentContext).toContain('tracked2.txt');
    expect(recentContext).toContain('edit just now');
    expect(recentContext).toContain('read just now');
    
    console.log('Recent files context:', recentContext);
  });

  test('should detect file changes over time', async () => {
    const changeFile = path.join(testDir, 'change-test.js');
    
    // Create initial file
    await fs.writeFile(changeFile, 'original content');
    
    // First scan - should register file
    await service.detectFileChanges(testDir);
    
    // Wait and modify file
    await new Promise(resolve => setTimeout(resolve, 100));
    await fs.writeFile(changeFile, 'modified content');
    
    // Second scan - should detect change
    const changesContext = await service.detectFileChanges(testDir);
    
    expect(changesContext).toContain('Recent File Changes');
    expect(changesContext).toContain('change-test.js (modified)');
    
    console.log('File changes context:', changesContext);
  });

  test('should build complete context with file tracking', async () => {
    // Create project structure
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({name: 'test'}, null, 2));
    await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'console.log("main");');
    
    // Track some file operations
    service.trackFileAccess(path.join(testDir, 'package.json'), 'read');
    service.trackFileAccess(path.join(testDir, 'src', 'index.js'), 'write');
    
    // Build complete context
    const completeContext = await service.buildCompleteContext(testDir);
    
    expect(completeContext).toContain('Current Working Directory');
    expect(completeContext).toContain('Environment Context');
    expect(completeContext).toContain('Project Type');
    expect(completeContext).toContain('Node.js project');
    expect(completeContext).toContain('Recently Accessed Files');
    expect(completeContext).toContain('package.json');
    expect(completeContext).toContain('index.js');
    
    console.log('Complete enhanced context preview:', completeContext.substring(0, 500));
    
    // Should be significantly richer than basic context
    expect(completeContext.length).toBeGreaterThan(500);
  });

  test('should handle multiple file operations tracking', async () => {
    const multiFile = path.join(testDir, 'multi-ops.js');
    
    // Simulate multiple operations on same file
    service.trackFileAccess(multiFile, 'write');
    await new Promise(resolve => setTimeout(resolve, 10));
    service.trackFileAccess(multiFile, 'read');
    await new Promise(resolve => setTimeout(resolve, 10));
    service.trackFileAccess(multiFile, 'edit');
    await new Promise(resolve => setTimeout(resolve, 10));
    service.trackFileAccess(multiFile, 'read');
    
    const context = service.getRecentFilesContext();
    
    // Should show most recent operation
    expect(context).toContain('multi-ops.js (read just now)');
    
    console.log('Multi-operation tracking:', context);
  });

  test('should limit recent files to reasonable number', async () => {
    // Track many files to test limit
    for (let i = 0; i < 20; i++) {
      const testFile = path.join(testDir, `limit-test-${i}.txt`);
      service.trackFileAccess(testFile, 'write');
    }
    
    const context = service.getRecentFilesContext();
    
    // Should only show recent 10 files
    const lines = context.split('\\n').filter(line => line.includes('limit-test'));
    expect(lines.length).toBeLessThanOrEqual(10);
    
    console.log('Limited recent files (should be ≤10):', lines.length);
  });

  test('should provide time-based file access information', async () => {
    // Create a fresh service to avoid interference from previous test
    const freshService = new ProjectContextService();
    
    const timeFile = path.join(testDir, 'time-test.js');
    
    // Track with small delays to test time formatting
    freshService.trackFileAccess(timeFile, 'write');
    
    const context = freshService.getRecentFilesContext();
    
    expect(context).toContain(path.basename(timeFile));
    expect(context).toMatch(/just now|\d+[mh] ago/);
    
    console.log('Time-based tracking:', context);
  });

  test('should integrate seamlessly with existing context building', async () => {
    // Create a realistic project
    await fs.writeFile(path.join(testDir, '.git'), ''); // Fake git repo
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'enhanced-context-test',
      scripts: { test: 'jest', build: 'webpack' }
    }, null, 2));
    
    // Track some operations
    service.trackFileAccess(path.join(testDir, 'package.json'), 'read');
    
    const context = await service.buildCompleteContext(testDir);
    
    // Should contain all context types
    expect(context).toContain('Working Directory');
    expect(context).toContain('Environment Context');
    expect(context).toContain('Project Type');
    expect(context).toContain('Recently Accessed Files');
    expect(context).toContain('Node.js project');
    expect(context).toContain('enhanced-context-test');
    
    console.log('✅ Enhanced context integration working');
  });
});