import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../bin/jsenvoy');

describe('Integration Tests', () => {
  it('should execute calculator tool successfully', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${binPath} calculator.calculator_evaluate --expression "40 + 2"`
    );
    
    expect(stderr).toBe('');
    expect(stdout).toContain('42');
  });

  it('should list modules', async () => {
    const { stdout, stderr } = await execAsync(`node ${binPath} list modules`);
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Available Modules');
    expect(stdout).toContain('calculator');
    expect(stdout).toContain('file');
  });

  it('should show help', async () => {
    const { stdout, stderr } = await execAsync(`node ${binPath} help`);
    
    expect(stderr).toBe('');
    expect(stdout).toContain('jsEnvoy CLI');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('Commands:');
  });

  it('should show tool help', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${binPath} help calculator.calculator_evaluate`
    );
    
    expect(stderr).toBe('');
    expect(stdout).toContain('Tool: calculator.calculator_evaluate');
    expect(stdout).toContain('Parameters:');
    expect(stdout).toContain('expression');
  });

  it('should output JSON when requested', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${binPath} --output json list modules`
    );
    
    expect(stderr).toBe('');
    // Since list outputs clean JSON, we can parse it
    const result = JSON.parse(stdout);
    expect(Array.isArray(result)).toBe(true);
    expect(result.some(m => m.name === 'calculator')).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    try {
      await execAsync(`node ${binPath} nonexistent.tool`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.stderr).toContain('Module not found:');
      expect(error.code).toBe(1);
    }
  });
});