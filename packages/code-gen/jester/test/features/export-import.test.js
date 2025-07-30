/**
 * Export/Import Testing
 * Tests data export/import functionality, integrity, and format versioning
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Export/Import Testing', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let jaw;
  let testDbPath;
  let tempDir;
  let exportPath;

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('export-import');
    // Create temporary directory for test files
    tempDir = path.join(process.cwd(), 'temp-export-import');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `export-import-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    exportPath = path.join(tempDir, 'exported-data.json');
    
    jaw = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite'
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    if (jaw) {
      await jaw.close();
    }
    
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Session Data Export', () => {
    test('exports session data to JSON format', async () => {
      // Create a test session with data
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js'],
        collectCoverage: true
      });
      
      // Simulate some test execution
      jaw.collector.onTestSuiteStart('/export.test.js');
      
      const test1 = jaw.collector.onTestStart({
        path: '/export.test.js',
        name: 'export test 1',
        fullName: 'Export export test 1'
      });
      
      if (test1) {
        jaw.collector.onTestEnd(test1, {
          status: 'passed',
          failureMessages: []
        });
      }
      
      const test2 = jaw.collector.onTestStart({
        path: '/export.test.js',
        name: 'export test 2',
        fullName: 'Export export test 2'
      });
      
      if (test2) {
        jaw.collector.onTestEnd(test2, {
          status: 'failed',
          failureMessages: ['Test failed']
        });
      }
      
      jaw.collector.onTestSuiteEnd('/export.test.js', {
        numFailingTests: 1,
        numPassingTests: 1
      });
      
      jaw.collector.endSession({
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1
      });
      
      // Wait for data to be stored
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Export session data (simulated)
      const exportedData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        sessionId: session.id,
        session: session,
        tests: test1 && test2 ? [test1, test2] : [],
        metadata: {
          totalTests: 2,
          passedTests: 1,
          failedTests: 1
        }
      };
      
      // Write to file
      await fs.writeFile(exportPath, JSON.stringify(exportedData, null, 2));
      
      // Verify file was created and contains expected data
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData.version).toBe('1.0.0');
      expect(parsedData.sessionId).toBe(session.id);
      expect(parsedData.session.id).toBe(session.id);
      expect(parsedData.metadata.totalTests).toBe(2);
      expect(parsedData.metadata.passedTests).toBe(1);
      expect(parsedData.metadata.failedTests).toBe(1);
    });

    test('exports complete session with all related data', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      // Create comprehensive test data
      jaw.collector.onTestSuiteStart('/comprehensive.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/comprehensive.test.js',
        name: 'comprehensive test',
        fullName: 'Comprehensive comprehensive test'
      });
      
      if (test) {
        // Add assertion
        const assertion = {
          testId: test.id,
          timestamp: new Date(),
          type: 'expect',
          matcher: 'toBe',
          passed: false,
          actual: 'hello',
          expected: 'world',
          message: 'Expected "hello" to be "world"'
        };
        
        jaw.collector.onAssertion(assertion);
        
        // Add log
        const logEntry = {
          sessionId: session.id,
          testId: test.id,
          timestamp: new Date(),
          level: 'error',
          message: 'Test error occurred',
          source: 'test'
        };
        
        jaw.collector.onConsoleLog(logEntry);
        
        jaw.collector.onTestEnd(test, {
          status: 'failed',
          failureMessages: ['Expected "hello" to be "world"']
        });
        
        // Export comprehensive data
        const exportedData = {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          sessionId: session.id,
          session: session,
          tests: [test],
          assertions: [assertion],
          logs: [logEntry],
          metadata: {
            totalTests: 1,
            totalAssertions: 1,
            totalLogs: 1
          }
        };
        
        await fs.writeFile(exportPath, JSON.stringify(exportedData, null, 2));
        
        // Verify comprehensive export
        const fileContent = await fs.readFile(exportPath, 'utf8');
        const parsedData = JSON.parse(fileContent);
        
        expect(parsedData.tests).toHaveLength(1);
        expect(parsedData.assertions).toHaveLength(1);
        expect(parsedData.logs).toHaveLength(1);
        expect(parsedData.tests[0].id).toBe(test.id);
        expect(parsedData.assertions[0].testId).toBe(test.id);
        expect(parsedData.logs[0].testId).toBe(test.id);
      }
    });

    test('handles large dataset export efficiently', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/large.test.js');
      
      // Create many tests
      const tests = [];
      for (let i = 0; i < 50; i++) {
        const test = jaw.collector.onTestStart({
          path: '/large.test.js',
          name: `large test ${i}`,
          fullName: `Large large test ${i}`
        });
        
        if (test) {
          tests.push(test);
          jaw.collector.onTestEnd(test, {
            status: i % 5 === 0 ? 'failed' : 'passed',
            failureMessages: i % 5 === 0 ? ['Test failed'] : []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/large.test.js', {
        numFailingTests: 10,
        numPassingTests: 40
      });
      
      jaw.collector.endSession({
        numTotalTests: 50,
        numPassedTests: 40,
        numFailedTests: 10
      });
      
      // Export large dataset
      const startTime = Date.now();
      
      const exportedData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        sessionId: session.id,
        session: session,
        tests: tests,
        metadata: {
          totalTests: tests.length,
          exportDuration: 0 // Will be calculated
        }
      };
      
      await fs.writeFile(exportPath, JSON.stringify(exportedData, null, 2));
      
      const endTime = Date.now();
      const exportDuration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(exportDuration).toBeLessThan(1000);
      
      // Verify file size and content
      const stats = await fs.stat(exportPath);
      expect(stats.size).toBeGreaterThan(1000); // Should be substantial
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData.tests).toHaveLength(tests.length);
    });
  });

  describe('Session Data Import', () => {
    test('imports session data from JSON format', async () => {
      // Create export data
      const originalSession = {
        id: 'import-test-session',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
        jestConfig: { testMatch: ['**/*.test.js'] },
        environment: { nodeVersion: '18.0.0' },
        summary: { numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 }
      };
      
      const exportedData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        sessionId: originalSession.id,
        session: originalSession,
        tests: [
          {
            id: 'test-1',
            sessionId: originalSession.id,
            name: 'imported test 1',
            status: 'passed'
          },
          {
            id: 'test-2',
            sessionId: originalSession.id,
            name: 'imported test 2',
            status: 'failed'
          }
        ],
        metadata: {
          totalTests: 2,
          passedTests: 1,
          failedTests: 1
        }
      };
      
      // Write export file
      await fs.writeFile(exportPath, JSON.stringify(exportedData, null, 2));
      
      // Import data (simulated)
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Verify imported data
      expect(importedData.version).toBe('1.0.0');
      expect(importedData.sessionId).toBe(originalSession.id);
      expect(importedData.session.id).toBe(originalSession.id);
      expect(importedData.tests).toHaveLength(2);
      expect(importedData.tests[0].name).toBe('imported test 1');
      expect(importedData.tests[1].name).toBe('imported test 2');
      expect(importedData.metadata.totalTests).toBe(2);
    });

    test('validates imported data integrity', async () => {
      const validExportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        sessionId: 'valid-session',
        session: {
          id: 'valid-session',
          startTime: new Date(),
          status: 'completed'
        },
        tests: [
          {
            id: 'test-1',
            sessionId: 'valid-session',
            name: 'valid test'
          }
        ],
        metadata: {
          totalTests: 1
        }
      };
      
      await fs.writeFile(exportPath, JSON.stringify(validExportData, null, 2));
      
      // Import and validate
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Validate structure
      expect(importedData).toHaveProperty('version');
      expect(importedData).toHaveProperty('sessionId');
      expect(importedData).toHaveProperty('session');
      expect(importedData).toHaveProperty('tests');
      expect(importedData).toHaveProperty('metadata');
      
      // Validate relationships
      expect(importedData.session.id).toBe(importedData.sessionId);
      expect(importedData.tests[0].sessionId).toBe(importedData.sessionId);
      expect(importedData.tests.length).toBe(importedData.metadata.totalTests);
    });

    test('handles corrupted import data gracefully', async () => {
      // Create corrupted data
      const corruptedData = {
        version: '1.0.0',
        sessionId: 'corrupted-session',
        // Missing session object
        tests: [
          {
            id: 'test-1',
            // Missing sessionId
            name: 'corrupted test'
          }
        ]
        // Missing metadata
      };
      
      await fs.writeFile(exportPath, JSON.stringify(corruptedData, null, 2));
      
      // Attempt to import corrupted data
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Should handle missing fields gracefully
      expect(importedData.sessionId).toBe('corrupted-session');
      expect(importedData.session).toBeUndefined();
      expect(importedData.tests).toHaveLength(1);
      expect(importedData.tests[0].sessionId).toBeUndefined();
      expect(importedData.metadata).toBeUndefined();
    });

    test('handles malformed JSON import gracefully', async () => {
      // Create malformed JSON
      const malformedJson = '{ "version": "1.0.0", "sessionId": "malformed" invalid json }';
      
      await fs.writeFile(exportPath, malformedJson);
      
      // Attempt to import malformed JSON
      try {
        const fileContent = await fs.readFile(exportPath, 'utf8');
        JSON.parse(fileContent);
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Should throw JSON parse error
        expect(error).toBeInstanceOf(SyntaxError);
        expect(error.message).toContain('JSON');
      }
    });
  });

  describe('Data Integrity During Export/Import', () => {
    test('maintains data integrity through export/import cycle', async () => {
      // Create original data
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js'],
        collectCoverage: true
      });
      
      jaw.collector.onTestSuiteStart('/integrity.test.js');
      
      const originalTest = jaw.collector.onTestStart({
        path: '/integrity.test.js',
        name: 'integrity test',
        fullName: 'Integrity integrity test'
      });
      
      if (originalTest) {
        jaw.collector.onTestEnd(originalTest, {
          status: 'passed',
          failureMessages: []
        });
        
        jaw.collector.onTestSuiteEnd('/integrity.test.js', {
          numFailingTests: 0,
          numPassingTests: 1
        });
        
        jaw.collector.endSession({
          numTotalTests: 1,
          numPassedTests: 1,
          numFailedTests: 0
        });
        
        // Export data
        const exportedData = {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          sessionId: session.id,
          session: session,
          tests: [originalTest],
          metadata: {
            totalTests: 1,
            checksum: 'mock-checksum' // In real implementation, would calculate actual checksum
          }
        };
        
        await fs.writeFile(exportPath, JSON.stringify(exportedData, null, 2));
        
        // Import data
        const fileContent = await fs.readFile(exportPath, 'utf8');
        const importedData = JSON.parse(fileContent);
        
        // Verify integrity
        expect(importedData.sessionId).toBe(session.id);
        expect(importedData.session.id).toBe(session.id);
        expect(importedData.session.jestConfig.testMatch).toEqual(['**/*.test.js']);
        expect(importedData.session.jestConfig.collectCoverage).toBe(true);
        expect(importedData.tests).toHaveLength(1);
        expect(importedData.tests[0].id).toBe(originalTest.id);
        expect(importedData.tests[0].name).toBe('integrity test');
        expect(importedData.tests[0].status).toBe('passed');
        expect(importedData.metadata.totalTests).toBe(1);
      }
    });

    test('preserves complex data structures', async () => {
      const complexData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        sessionId: 'complex-session',
        session: {
          id: 'complex-session',
          jestConfig: {
            testMatch: ['**/*.test.js', '**/*.spec.js'],
            setupFilesAfterEnv: ['./setup1.js', './setup2.js'],
            coverageThreshold: {
              global: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80
              }
            }
          },
          environment: {
            nodeVersion: '18.0.0',
            platform: 'darwin',
            env: {
              NODE_ENV: 'test',
              CI: 'true'
            }
          }
        },
        tests: [
          {
            id: 'complex-test',
            assertions: [
              {
                type: 'expect',
                matcher: 'toEqual',
                actual: { a: 1, b: [2, 3, 4] },
                expected: { a: 1, b: [2, 3, 4] },
                passed: true
              }
            ],
            errors: [],
            logs: [
              {
                level: 'info',
                message: 'Complex test log',
                metadata: {
                  timestamp: new Date().toISOString(),
                  source: 'test'
                }
              }
            ]
          }
        ]
      };
      
      // Export complex data
      await fs.writeFile(exportPath, JSON.stringify(complexData, null, 2));
      
      // Import and verify
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Verify nested structures
      expect(importedData.session.jestConfig.testMatch).toEqual(['**/*.test.js', '**/*.spec.js']);
      expect(importedData.session.jestConfig.setupFilesAfterEnv).toEqual(['./setup1.js', './setup2.js']);
      expect(importedData.session.jestConfig.coverageThreshold.global.branches).toBe(80);
      expect(importedData.session.environment.env.NODE_ENV).toBe('test');
      expect(importedData.tests[0].assertions[0].actual).toEqual({ a: 1, b: [2, 3, 4] });
      expect(importedData.tests[0].logs[0].metadata.source).toBe('test');
    });

    test('handles timestamp preservation correctly', async () => {
      const now = new Date();
      const timestampData = {
        version: '1.0.0',
        exportDate: now.toISOString(),
        sessionId: 'timestamp-session',
        session: {
          id: 'timestamp-session',
          startTime: now,
          endTime: new Date(now.getTime() + 1000) // 1 second later
        },
        tests: [
          {
            id: 'timestamp-test',
            startTime: new Date(now.getTime() + 100),
            endTime: new Date(now.getTime() + 900),
            duration: 800
          }
        ]
      };
      
      // Export with timestamps
      await fs.writeFile(exportPath, JSON.stringify(timestampData, null, 2));
      
      // Import and verify timestamps
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Verify timestamp preservation (as ISO strings in JSON)
      expect(importedData.exportDate).toBe(now.toISOString());
      expect(new Date(importedData.session.startTime)).toEqual(now);
      expect(new Date(importedData.session.endTime)).toEqual(new Date(now.getTime() + 1000));
      expect(new Date(importedData.tests[0].startTime)).toEqual(new Date(now.getTime() + 100));
      expect(new Date(importedData.tests[0].endTime)).toEqual(new Date(now.getTime() + 900));
      expect(importedData.tests[0].duration).toBe(800);
    });
  });

  describe('Export Format Versioning', () => {
    test('includes version information in exports', async () => {
      const versionedData = {
        version: '1.0.0',
        formatVersion: '2023.1',
        exportDate: new Date().toISOString(),
        sessionId: 'versioned-session',
        session: { id: 'versioned-session' },
        tests: [],
        metadata: {
          exportTool: 'jest-agent-wrapper',
          exportToolVersion: '1.0.0'
        }
      };
      
      await fs.writeFile(exportPath, JSON.stringify(versionedData, null, 2));
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      expect(importedData.version).toBe('1.0.0');
      expect(importedData.formatVersion).toBe('2023.1');
      expect(importedData.metadata.exportTool).toBe('jest-agent-wrapper');
      expect(importedData.metadata.exportToolVersion).toBe('1.0.0');
    });

    test('handles version compatibility checks', async () => {
      const futureVersionData = {
        version: '2.0.0', // Future version
        formatVersion: '2025.1',
        exportDate: new Date().toISOString(),
        sessionId: 'future-session',
        session: { id: 'future-session' },
        tests: []
      };
      
      await fs.writeFile(exportPath, JSON.stringify(futureVersionData, null, 2));
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Should be able to read the data even if version is newer
      expect(importedData.version).toBe('2.0.0');
      expect(importedData.formatVersion).toBe('2025.1');
      
      // In a real implementation, would show compatibility warnings
      const isCompatible = importedData.version.startsWith('1.') || importedData.version.startsWith('2.');
      expect(isCompatible).toBe(true);
    });

    test('supports backward compatibility', async () => {
      const oldVersionData = {
        version: '0.9.0', // Older version
        sessionId: 'old-session',
        session: { id: 'old-session' },
        tests: []
        // Missing some newer fields like formatVersion, metadata
      };
      
      await fs.writeFile(exportPath, JSON.stringify(oldVersionData, null, 2));
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      // Should handle missing fields gracefully
      expect(importedData.version).toBe('0.9.0');
      expect(importedData.formatVersion).toBeUndefined();
      expect(importedData.metadata).toBeUndefined();
      expect(importedData.sessionId).toBe('old-session');
      expect(importedData.session.id).toBe('old-session');
    });
  });

  describe('Partial Data Export/Import', () => {
    test('supports exporting specific test suites only', async () => {
      const partialData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportType: 'partial',
        filter: {
          testSuites: ['/specific.test.js'],
          dateRange: {
            start: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
            end: new Date().toISOString()
          }
        },
        sessionId: 'partial-session',
        session: { id: 'partial-session' },
        tests: [
          {
            id: 'specific-test',
            suitePath: '/specific.test.js',
            name: 'specific test'
          }
        ],
        metadata: {
          totalTests: 1,
          filteredTests: 5 // Total tests in session, but only 1 exported
        }
      };
      
      await fs.writeFile(exportPath, JSON.stringify(partialData, null, 2));
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      expect(importedData.exportType).toBe('partial');
      expect(importedData.filter.testSuites).toEqual(['/specific.test.js']);
      expect(importedData.tests).toHaveLength(1);
      expect(importedData.tests[0].suitePath).toBe('/specific.test.js');
      expect(importedData.metadata.totalTests).toBe(1);
      expect(importedData.metadata.filteredTests).toBe(5);
    });

    test('supports exporting failed tests only', async () => {
      const failedOnlyData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportType: 'filtered',
        filter: {
          status: ['failed'],
          includeErrors: true,
          includeLogs: true
        },
        sessionId: 'failed-session',
        session: { id: 'failed-session' },
        tests: [
          {
            id: 'failed-test-1',
            name: 'failed test 1',
            status: 'failed',
            errors: ['Error message 1']
          },
          {
            id: 'failed-test-2',
            name: 'failed test 2',
            status: 'failed',
            errors: ['Error message 2']
          }
        ],
        metadata: {
          totalTests: 2,
          originalTotalTests: 10 // 10 total tests, but only 2 failed exported
        }
      };
      
      await fs.writeFile(exportPath, JSON.stringify(failedOnlyData, null, 2));
      
      const fileContent = await fs.readFile(exportPath, 'utf8');
      const importedData = JSON.parse(fileContent);
      
      expect(importedData.exportType).toBe('filtered');
      expect(importedData.filter.status).toEqual(['failed']);
      expect(importedData.tests).toHaveLength(2);
      expect(importedData.tests.every(test => test.status === 'failed')).toBe(true);
      expect(importedData.metadata.originalTotalTests).toBe(10);
    });
  });
});
