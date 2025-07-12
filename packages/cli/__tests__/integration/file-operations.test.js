import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI File Operations Integration', () => {
  const testDir = path.join(__dirname, 'test-files');
  const cliPath = path.resolve(__dirname, '../../src/index.js');
  
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  function runCLI(commands) {
    return new Promise((resolve, reject) => {
      const cli = spawn('node', [cliPath, 'interactive'], {
        cwd: testDir
      });
      
      let output = '';
      let errorOutput = '';
      
      cli.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      cli.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      cli.on('error', reject);
      
      cli.on('close', (code) => {
        resolve({ output, errorOutput, code });
      });
      
      // Send commands
      commands.forEach(cmd => {
        cli.stdin.write(cmd + '\n');
      });
      cli.stdin.write('exit\n');
      cli.stdin.end();
    });
  }

  test('write command creates file with quoted content', async () => {
    const result = await runCLI(['write test1.txt "hello world"']);
    
    expect(result.output).toContain('Writing file: test1.txt');
    
    // Check file was created
    const content = await fs.readFile(path.join(testDir, 'test1.txt'), 'utf-8');
    expect(content).toBe('hello world');
  });

  test('write command creates file with unquoted multi-word content', async () => {
    const result = await runCLI(['write test2.txt hello world this is a test']);
    
    expect(result.output).toContain('Writing file: test2.txt');
    
    // Check file was created with all words
    const content = await fs.readFile(path.join(testDir, 'test2.txt'), 'utf-8');
    expect(content).toBe('hello world this is a test');
  });

  test('write command creates file with single word', async () => {
    const result = await runCLI(['write test3.txt hello']);
    
    expect(result.output).toContain('Writing file: test3.txt');
    
    const content = await fs.readFile(path.join(testDir, 'test3.txt'), 'utf-8');
    expect(content).toBe('hello');
  });

  test('write command creates empty file with empty quotes', async () => {
    const result = await runCLI(['write test4.txt ""']);
    
    expect(result.output).toContain('Writing file: test4.txt');
    
    const content = await fs.readFile(path.join(testDir, 'test4.txt'), 'utf-8');
    expect(content).toBe('');
  });

  test('mkdir command creates directory', async () => {
    const result = await runCLI(['mkdir testdir']);
    
    expect(result.output).toContain('Creating directory: testdir');
    
    // Check directory was created
    const stats = await fs.stat(path.join(testDir, 'testdir'));
    expect(stats.isDirectory()).toBe(true);
  });

  test('write and read commands work together', async () => {
    const result = await runCLI([
      'write readtest.txt "content to read"',
      'read readtest.txt'
    ]);
    
    expect(result.output).toContain('Writing file: readtest.txt');
    expect(result.output).toContain('Reading file: readtest.txt');
    expect(result.output).toContain('content to read');
  });

  test('write to subdirectory after mkdir', async () => {
    const result = await runCLI([
      'mkdir subdir',
      'write subdir/file.txt "file in subdirectory"'
    ]);
    
    expect(result.output).toContain('Creating directory: subdir');
    expect(result.output).toContain('Writing file: subdir/file.txt');
    
    const content = await fs.readFile(path.join(testDir, 'subdir/file.txt'), 'utf-8');
    expect(content).toBe('file in subdirectory');
  });

  test('calc command works with expression', async () => {
    const result = await runCLI(['calc 10*5+2']);
    
    expect(result.output).toContain('Result: 52');
  });

  test('handles file not found error gracefully', async () => {
    const result = await runCLI(['read nonexistent.txt']);
    
    expect(result.output).toContain('Error: File not found');
  });

  test('handles write to readonly directory gracefully', async () => {
    // This test would require setting up readonly permissions
    // Skip for now as it's platform-specific
  });
}, 30000); // Increase timeout for integration tests