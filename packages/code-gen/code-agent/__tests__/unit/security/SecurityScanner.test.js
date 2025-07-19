/**
 * SecurityScanner Tests
 */

import { jest } from '@jest/globals';
import { SecurityScanner } from '../../../src/security/SecurityScanner.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SecurityScanner', () => {
  let scanner;
  let testDir;

  beforeEach(async () => {
    scanner = new SecurityScanner();
    
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `security-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Pattern Detection', () => {
    test('should detect eval() usage', async () => {
      const testFile = path.join(testDir, 'dangerous.js');
      await fs.writeFile(testFile, `
        const userInput = req.body.code;
        eval(userInput); // Dangerous!
      `);

      const report = await scanner.scanProject(testDir);
      
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0].severity).toBe('critical');
      expect(report.findings[0].message).toContain('eval()');
    });

    test('should detect SQL injection patterns', async () => {
      const testFile = path.join(testDir, 'sql.js');
      await fs.writeFile(testFile, `
        const query = "SELECT * FROM users WHERE id = " + userId;
        db.query(query);
      `);

      const report = await scanner.scanProject(testDir);
      
      const sqlFinding = report.findings.find(f => f.message.includes('SQL injection'));
      expect(sqlFinding).toBeDefined();
      expect(sqlFinding.severity).toBe('critical');
    });

    test('should detect hardcoded secrets', async () => {
      const testFile = path.join(testDir, 'config.js');
      await fs.writeFile(testFile, `
        const api_key = "sk-1234567890abcdef";
        const password = "admin123";
      `);

      const report = await scanner.scanProject(testDir);
      
      const secretFindings = report.findings.filter(f => f.type === 'pattern');
      expect(secretFindings.length).toBeGreaterThan(0);
      expect(secretFindings.some(f => f.message.includes('API key'))).toBe(true);
      expect(secretFindings.some(f => f.message.includes('password'))).toBe(true);
    });
  });

  describe('Dependency Checking', () => {
    test('should detect vulnerable packages', async () => {
      const packageJson = {
        dependencies: {
          'event-stream': '3.3.4', // Known malicious package
          'express': '^4.18.0'
        }
      };
      
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const report = await scanner.scanProject(testDir);
      
      const depFinding = report.findings.find(f => 
        f.type === 'dependency' && f.package === 'event-stream'
      );
      expect(depFinding).toBeDefined();
      expect(depFinding.severity).toBe('critical');
    });

    test('should detect git dependencies', async () => {
      const packageJson = {
        dependencies: {
          'my-package': 'git+https://github.com/user/repo.git'
        }
      };
      
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const report = await scanner.scanProject(testDir);
      
      const gitFinding = report.findings.find(f => 
        f.message.includes('Git dependency')
      );
      expect(gitFinding).toBeDefined();
    });
  });

  describe('Best Practices', () => {
    test('should check for missing .gitignore entries', async () => {
      await fs.writeFile(path.join(testDir, '.gitignore'), 'node_modules\n');

      const report = await scanner.scanProject(testDir);
      
      const gitignoreFinding = report.findings.find(f => 
        f.message.includes('.env')
      );
      expect(gitignoreFinding).toBeDefined();
      expect(gitignoreFinding.severity).toBe('high');
    });

    test('should detect empty catch blocks', async () => {
      const testFile = path.join(testDir, 'error.js');
      await fs.writeFile(testFile, `
        try {
          doSomething();
        } catch (error) {
          // Empty catch block
        }
      `);

      const report = await scanner.scanProject(testDir);
      
      const catchFinding = report.findings.find(f => 
        f.message.includes('Empty catch block')
      );
      expect(catchFinding).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('should respect custom rules', async () => {
      scanner = new SecurityScanner({
        customRules: [{
          pattern: /TODO.*security/i,
          severity: 'high',
          message: 'Security TODO found'
        }]
      });

      const testFile = path.join(testDir, 'todo.js');
      await fs.writeFile(testFile, '// TODO: Fix security issue');

      const report = await scanner.scanProject(testDir);
      
      const customFinding = report.findings.find(f => 
        f.message === 'Security TODO found'
      );
      expect(customFinding).toBeDefined();
      expect(customFinding.type).toBe('custom');
    });

    test('should ignore specified paths', async () => {
      scanner = new SecurityScanner({
        ignorePaths: ['node_modules', 'test']
      });

      await fs.mkdir(path.join(testDir, 'test'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'test', 'dangerous.js'),
        'eval("dangerous")'
      );

      const report = await scanner.scanProject(testDir);
      
      expect(report.findings).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive report', async () => {
      // Create files with various issues
      await fs.writeFile(path.join(testDir, 'dangerous.js'), 'eval(userInput)');
      await fs.writeFile(path.join(testDir, 'secret.js'), 'const api_key = "secret"');
      
      const report = await scanner.scanProject(testDir);
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalFindings).toBeGreaterThan(0);
      expect(report.summary.filesScanned).toBeGreaterThan(0);
      expect(report.byType).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.findings)).toBe(true);
    });

    test('should categorize findings by severity', async () => {
      await fs.writeFile(path.join(testDir, 'mixed.js'), `
        eval(data); // Critical
        document.write(html); // High
        console.log(password); // Low
      `);

      const report = await scanner.scanProject(testDir);
      
      expect(report.summary.critical).toBeGreaterThan(0);
      expect(report.summary.high).toBeGreaterThan(0);
      expect(report.summary.low).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('should emit scan events', async () => {
      const events = [];
      
      scanner.on('scan:started', (e) => events.push({ type: 'started', data: e }));
      scanner.on('scan:completed', (e) => events.push({ type: 'completed', data: e }));
      scanner.on('finding', (e) => events.push({ type: 'finding', data: e }));

      await fs.writeFile(path.join(testDir, 'test.js'), 'eval("test")');
      await scanner.scanProject(testDir);

      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
      expect(events.some(e => e.type === 'finding')).toBe(true);
    });

    test('should emit error events', async () => {
      const errorListener = jest.fn();
      scanner.on('error', errorListener);

      // Scan non-existent directory
      await scanner.scanProject('/non/existent/path');

      expect(errorListener).toHaveBeenCalled();
    });
  });
});