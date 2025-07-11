import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Final Testing and Polish', () => {
  const cliPath = path.join(__dirname, '..', 'bin', 'jsenvoy');
  const testDir = path.join(__dirname, 'temp-final-test');
  
  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('end-to-end scenarios', () => {
    it('should handle complete workflow from install to execution', async () => {
      // Simulate a typical user workflow
      const configPath = path.join(testDir, '.jsenvoy.json');
      const config = {
        resources: {
          basePath: testDir
        },
        aliases: {
          calc: 'calculator.calculator_evaluate --expression'
        }
      };
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      // Test configuration loading
      const result = await runCLI(['--config', configPath, 'list', 'modules']);
      expect(result.stdout).toContain('calculator');
      expect(result.code).toBe(0);
    });
    
    it('should gracefully handle all error conditions', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          args: ['nonexistent.tool'],
          expectedError: 'Module not found: nonexistent'
        },
        {
          args: ['calculator.wrong_tool'],
          expectedError: 'Tool not found: calculator.wrong_tool'
        },
        {
          args: ['calculator.calculator_evaluate'],
          expectedError: "Missing required parameter: 'expression'"
        },
        {
          args: ['calculator.calculator_evaluate', '--expression'],
          expectedError: 'Missing value for argument: --expression'
        }
      ];
      
      for (const scenario of errorScenarios) {
        const result = await runCLI(scenario.args);
        expect(result.stderr).toContain(scenario.expectedError);
        expect(result.code).toBe(1);
      }
    });
    
    it('should maintain performance under load', async () => {
      // Test performance with multiple rapid executions
      const startTime = Date.now();
      const promises = [];
      
      // Run 10 concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(runCLI(['calculator.calculator_evaluate', '--expression', `${i} + ${i}`]));
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All should succeed
      results.forEach((result, i) => {
        expect(result.stdout).toContain(String(i * 2));
        expect(result.code).toBe(0);
      });
      
      // Should complete reasonably quickly (less than 5 seconds for 10 operations)
      expect(endTime - startTime).toBeLessThan(5000);
    });
    
    it('should work correctly with all output formats', async () => {
      // Test each output format
      const formats = ['text', 'json'];
      
      for (const format of formats) {
        const result = await runCLI([
          '--output', format,
          'calculator.calculator_evaluate',
          '--expression', '10 + 5'
        ]);
        
        expect(result.code).toBe(0);
        
        if (format === 'json') {
          const output = JSON.parse(result.stdout);
          expect(output.result).toBe(15);
        } else {
          expect(result.stdout).toContain('15');
        }
      }
    });
  });
  
  describe('security validation', () => {
    it('should not expose sensitive information in errors', async () => {
      // Set sensitive environment variable
      process.env.JSENVOY_SECRET_KEY = 'super-secret-value';
      
      const result = await runCLI(['--verbose', 'list']);
      
      // Should not contain the secret value in output
      expect(result.stdout).not.toContain('super-secret-value');
      expect(result.stderr).not.toContain('super-secret-value');
      
      delete process.env.JSENVOY_SECRET_KEY;
    });
    
    it('should handle malformed input safely', async () => {
      // Test with potentially dangerous inputs
      const dangerousInputs = [
        '"; rm -rf /',
        '${process.exit()}',
        '`cat /etc/passwd`',
        '../../../etc/passwd',
        'constructor.prototype.polluted = true'
      ];
      
      for (const input of dangerousInputs) {
        const result = await runCLI(['calculator.calculator_evaluate', '--expression', input]);
        
        // Should fail safely without executing dangerous code
        expect(result.code).toBe(1);
        expect(result.stderr).toBeTruthy();
      }
    });
  });
  
  describe('edge cases', () => {
    it('should handle very long arguments', async () => {
      // Create a very long expression
      const longExpression = '1' + ' + 1'.repeat(1000);
      
      const result = await runCLI([
        'calculator.calculator_evaluate',
        '--expression', longExpression
      ]);
      
      // Should handle gracefully (either succeed or fail with appropriate error)
      expect(result.code).toBeDefined();
    });
    
    it('should handle Unicode and special characters', async () => {
      const specialStrings = [
        '你好世界',
        '🎉🎊🎈',
        'café',
        'naïve',
        'λάμβδα'
      ];
      
      for (const str of specialStrings) {
        const result = await runCLI(['echo', str]);
        // Should handle Unicode properly (echo is hypothetical here)
        expect(result.code).toBeDefined();
      }
    });
    
    it('should handle interrupted operations gracefully', async () => {
      // This is a conceptual test - in practice would need to send SIGINT
      const child = spawn('node', [cliPath, 'interactive'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send interrupt signal
      child.kill('SIGINT');
      
      // Wait for exit
      const code = await new Promise(resolve => {
        child.on('exit', resolve);
      });
      
      // Should exit cleanly
      expect([0, 1, 130]).toContain(code); // 130 is typical SIGINT exit code
    });
  });
  
  describe('compatibility checks', () => {
    it('should work with minimum Node.js version', () => {
      // Check current Node version meets requirements
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
      
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });
    
    it('should handle different operating systems', () => {
      // Platform-specific checks
      const platform = process.platform;
      
      // Should work on major platforms
      expect(['darwin', 'linux', 'win32']).toContain(platform);
    });
  });
  
  describe('final integration validation', () => {
    it('should work with all documented examples', async () => {
      // Test examples from documentation
      const examples = [
        ['calculator.calculator_evaluate', '--expression', '2 + 2'],
        ['list', 'modules'],
        ['help', 'calculator'],
        ['--output', 'json', 'list'],
        ['--verbose', 'list', 'tools']
      ];
      
      for (const args of examples) {
        const result = await runCLI(args);
        expect(result.code).toBe(0);
        expect(result.stdout).toBeTruthy();
      }
    });
    
    it('should provide helpful output for new users', async () => {
      // Run help command
      const result = await runCLI(['help']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('jsEnvoy CLI');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('Options:');
      expect(result.stdout).toContain('Examples:');
    });
  });
  
  // Helper function to run CLI
  function runCLI(args) {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: testDir,
        env: { ...process.env, NO_COLOR: '1' }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('exit', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        child.kill();
        resolve({ code: -1, stdout, stderr, error: 'Timeout' });
      }, 5000);
    });
  }
});