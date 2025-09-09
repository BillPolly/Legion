/**
 * Integration tests for MemoryTool with real file system
 * NO MOCKS - uses real file operations
 */

import MemoryTool from '../../src/tools/MemoryTool.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MemoryTool Integration', () => {
  let tool;
  let testMemoryDir;

  beforeEach(async () => {
    // Create real test memory directory
    testMemoryDir = path.join(os.tmpdir(), `gemini-memory-test-${Date.now()}`);
    await fs.mkdir(testMemoryDir, { recursive: true });

    tool = new MemoryTool({ 
      memoryDir: testMemoryDir,
      memoryFile: 'GEMINI.md'
    });
  });

  afterEach(async () => {
    // Clean up real test files
    try {
      await fs.rm(testMemoryDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should save memory to real file system', async () => {
    const fact = 'User prefers TypeScript for new projects';
    
    const result = await tool._execute({ fact });

    expect(result.saved).toBe(true);
    expect(result.fact).toBe(fact);
    expect(result.memoryPath).toBe(path.join(testMemoryDir, 'GEMINI.md'));

    // Verify file was actually created
    const memoryFileExists = await fs.access(result.memoryPath).then(() => true).catch(() => false);
    expect(memoryFileExists).toBe(true);

    // Verify content was written correctly
    const content = await fs.readFile(result.memoryPath, 'utf-8');
    expect(content).toContain('## Gemini Added Memories');
    expect(content).toContain(fact);
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Timestamp format
  });

  test('should append to existing memory file', async () => {
    const fact1 = 'User likes dark mode';
    const fact2 = 'User works on React projects';

    // Save first fact
    await tool._execute({ fact: fact1 });
    
    // Save second fact
    const result2 = await tool._execute({ fact: fact2 });

    expect(result2.saved).toBe(true);

    // Check both facts are in the file
    const content = await fs.readFile(result2.memoryPath, 'utf-8');
    expect(content).toContain(fact1);
    expect(content).toContain(fact2);
    expect(content).toContain('## Gemini Added Memories');

    // Should have two timestamp entries
    const timestampMatches = content.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g);
    expect(timestampMatches.length).toBe(2);
  });

  test('should create memory directory if it does not exist', async () => {
    const newMemoryDir = path.join(testMemoryDir, 'nested', 'deep', 'memory');
    const newTool = new MemoryTool({
      memoryDir: newMemoryDir,
      memoryFile: 'GEMINI.md'
    });

    const result = await newTool._execute({ 
      fact: 'Test memory creation'
    });

    expect(result.saved).toBe(true);

    // Verify nested directory was created
    const dirExists = await fs.access(newMemoryDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);

    // Verify file was created
    const fileExists = await fs.access(path.join(newMemoryDir, 'GEMINI.md')).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should load saved memories', async () => {
    // Save some facts
    await tool._execute({ fact: 'User name is John' });
    await tool._execute({ fact: 'User works at TechCorp' });

    // Load memories
    const memories = await tool.loadMemories();

    expect(memories).toContain('User name is John');
    expect(memories).toContain('User works at TechCorp');
  });

  test('should handle empty memory file', async () => {
    // Try to load from non-existent memory file
    const memories = await tool.loadMemories();
    expect(memories).toBe('');
  });

  test('should validate fact input', async () => {
    await expect(tool._execute({
      fact: ''
    })).rejects.toThrow('Fact cannot be empty');

    await expect(tool._execute({
      fact: 123
    })).rejects.toThrow('Fact must be a string');
  });

  test('should preserve existing content when adding memories', async () => {
    const memoryPath = path.join(testMemoryDir, 'GEMINI.md');
    
    // Create existing content
    const existingContent = `# My Project Notes

This is my project documentation.

## Important Notes
- Remember to run tests
- Code should be clean`;

    await fs.writeFile(memoryPath, existingContent);

    // Add new memory
    await tool._execute({ fact: 'User prefers semicolons in JavaScript' });

    // Check content was preserved and memory was added
    const finalContent = await fs.readFile(memoryPath, 'utf-8');
    expect(finalContent).toContain('# My Project Notes');
    expect(finalContent).toContain('## Important Notes');
    expect(finalContent).toContain('## Gemini Added Memories');
    expect(finalContent).toContain('User prefers semicolons in JavaScript');
  });
});