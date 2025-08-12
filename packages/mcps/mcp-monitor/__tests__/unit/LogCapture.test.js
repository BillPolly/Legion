/**
 * Unit tests for Log Capture functionality
 * This is the core functionality - capturing server output as logs
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Log Capture System', () => {
  let sessionManager;
  let simplifiedTools;
  let activeProcesses = [];
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    simplifiedTools = new SimplifiedTools(sessionManager);
  });
  
  afterEach(async () => {
    // Clean up any spawned processes
    for (const proc of activeProcesses) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        // Process may already be dead
      }
    }
    activeProcesses = [];
    jest.restoreAllMocks();
  });
  
  describe('setupLogCapture', () => {
    it('should capture stdout from a process', async () => {
      const sessionId = 'test-stdout-capture';
      
      // Create a simple script that outputs to stdout
      const scriptPath = path.join(__dirname, 'test-stdout.js');
      const scriptCode = `
        console.log('Starting server...');
        console.log('Server initialized');
        setTimeout(() => {
          console.log('Server ready');
        }, 100);
        setTimeout(() => {
          console.log('Handling request');
        }, 200);
        // Keep alive
        setTimeout(() => {}, 5000);
      `;
      fs.writeFileSync(scriptPath, scriptCode);
      
      try {
        // Start the process
        const proc = spawn('node', [scriptPath]);
        activeProcesses.push(proc);
        
        // Create a mock monitor with log capture
        const capturedLogs = [];
        const mockLogManagerActor = {
          receive: jest.fn(async (msg) => {
            if (msg.type === 'log') {
              capturedLogs.push(msg.data);
            }
          })
        };
        
        const mockMonitor = {
          logManager: {
            capture: jest.fn((log) => {
              capturedLogs.push(log);
            }),
            query: jest.fn().mockResolvedValue([])
          },
          getState: jest.fn().mockReturnValue('running'),
          setState: jest.fn()
        };
        
        // Register the monitor
        sessionManager.monitors.set(sessionId, mockMonitor);
        
        // Create the ActorSpace structure
        sessionManager.actorSpaces = new Map();
        sessionManager.actorSpaces.set(sessionId, {
          actors: {
            logManager: mockLogManagerActor
          }
        });
        
        // Setup log capture
        await simplifiedTools.setupLogCapture(proc, sessionId, mockMonitor);
        
        // Wait for logs to be captured
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify logs were captured via LogManagerActor
        expect(mockLogManagerActor.receive).toHaveBeenCalled();
        expect(capturedLogs.length).toBeGreaterThan(0);
        
        // Check the content of captured logs
        const logMessages = capturedLogs.map(log => log.message);
        expect(logMessages).toContain('Starting server...');
        expect(logMessages).toContain('Server initialized');
        expect(logMessages).toContain('Server ready');
        
      } finally {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      }
    });
    
    it('should capture stderr from a process', async () => {
      const sessionId = 'test-stderr-capture';
      
      // Create a script that outputs to stderr
      const scriptPath = path.join(__dirname, 'test-stderr.js');
      const scriptCode = `
        console.error('Error: Database connection failed');
        console.warn('Warning: Using default config');
        setTimeout(() => {
          console.error('Error: Port already in use');
        }, 100);
        // Keep alive
        setTimeout(() => {}, 5000);
      `;
      fs.writeFileSync(scriptPath, scriptCode);
      
      try {
        // Start the process
        const proc = spawn('node', [scriptPath]);
        activeProcesses.push(proc);
        
        // Create a mock monitor with log capture
        const capturedLogs = [];
        const mockLogManagerActor = {
          receive: jest.fn(async (msg) => {
            if (msg.type === 'log') {
              capturedLogs.push(msg.data);
            }
          })
        };
        
        const mockMonitor = {
          logManager: {
            capture: jest.fn((log) => {
              capturedLogs.push(log);
            }),
            query: jest.fn().mockResolvedValue([])
          },
          getState: jest.fn().mockReturnValue('running'),
          setState: jest.fn()
        };
        
        // Register the monitor
        sessionManager.monitors.set(sessionId, mockMonitor);
        
        // Create the ActorSpace structure
        sessionManager.actorSpaces = new Map();
        sessionManager.actorSpaces.set(sessionId, {
          actors: {
            logManager: mockLogManagerActor
          }
        });
        
        // Setup log capture
        await simplifiedTools.setupLogCapture(proc, sessionId, mockMonitor);
        
        // Wait for logs to be captured
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify error logs were captured
        expect(mockLogManagerActor.receive).toHaveBeenCalled();
        
        const errorLogs = capturedLogs.filter(log => log.level === 'error');
        expect(errorLogs.length).toBeGreaterThan(0);
        
        const errorMessages = errorLogs.map(log => log.message);
        expect(errorMessages.some(msg => msg.includes('Database connection failed'))).toBe(true);
        expect(errorMessages.some(msg => msg.includes('Port already in use'))).toBe(true);
        
      } finally {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      }
    });
    
    it('should handle process that exits quickly', async () => {
      const sessionId = 'test-quick-exit';
      
      // Create a script that exits immediately
      const scriptPath = path.join(__dirname, 'test-quick-exit.js');
      const scriptCode = `
        console.log('Starting...');
        console.error('Fatal error!');
        process.exit(1);
      `;
      fs.writeFileSync(scriptPath, scriptCode);
      
      try {
        // Start the process
        const proc = spawn('node', [scriptPath]);
        activeProcesses.push(proc);
        
        // Create a mock monitor with log capture
        const capturedLogs = [];
        const mockLogManagerActor = {
          receive: jest.fn(async (msg) => {
            if (msg.type === 'log') {
              capturedLogs.push(msg.data);
            }
          })
        };
        
        const mockMonitor = {
          logManager: {
            capture: jest.fn((log) => {
              capturedLogs.push(log);
            }),
            query: jest.fn().mockResolvedValue([])
          },
          getState: jest.fn().mockReturnValue('running'),
          setState: jest.fn()
        };
        
        // Register the monitor
        sessionManager.monitors.set(sessionId, mockMonitor);
        
        // Create the ActorSpace structure
        sessionManager.actorSpaces = new Map();
        sessionManager.actorSpaces.set(sessionId, {
          actors: {
            logManager: mockLogManagerActor
          }
        });
        
        // Setup log capture
        await simplifiedTools.setupLogCapture(proc, sessionId, mockMonitor);
        
        // Wait for process to exit and logs to be captured
        await new Promise(resolve => {
          proc.on('exit', () => {
            setTimeout(resolve, 100); // Give time for final log processing
          });
        });
        
        // Should still capture the logs before exit
        expect(mockLogManagerActor.receive).toHaveBeenCalled();
        expect(capturedLogs.length).toBeGreaterThan(0);
        
        const messages = capturedLogs.map(log => log.message);
        expect(messages.some(msg => msg.includes('Starting...'))).toBe(true);
        expect(messages.some(msg => msg.includes('Fatal error!'))).toBe(true);
        
      } finally {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      }
    });
  });
  
  describe('queryLogs', () => {
    it('should retrieve captured logs', async () => {
      const sessionId = 'test-query-logs';
      
      // Create mock logs
      const mockLogs = [
        { timestamp: new Date(), level: 'info', message: 'Server starting' },
        { timestamp: new Date(), level: 'error', message: 'Database error' },
        { timestamp: new Date(), level: 'info', message: 'Server ready' }
      ];
      
      // Create a mock monitor with actor space
      const mockMonitor = {
        logManager: {
          capture: jest.fn(),
          query: jest.fn().mockResolvedValue(mockLogs)
        }
      };
      
      // Create mock actor space
      const mockActorSpace = {
        actors: {
          logManager: {
            receive: jest.fn().mockImplementation((msg) => {
              if (msg.type === 'query-logs') {
                return Promise.resolve({
                  success: true,
                  logs: mockLogs
                });
              }
              if (msg.type === 'search-logs') {
                const filtered = mockLogs.filter(log => 
                  log.message.toLowerCase().includes(msg.data.query.toLowerCase())
                );
                return Promise.resolve({
                  success: true,
                  logs: filtered
                });
              }
            })
          }
        }
      };
      
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, mockActorSpace);
      
      // Query all logs
      const result = await simplifiedTools.queryLogs({
        session_id: sessionId,
        limit: 10
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Server starting');
      expect(result.content[0].text).toContain('Database error');
      expect(result.content[0].text).toContain('Server ready');
      
      // Query with search term
      const searchResult = await simplifiedTools.queryLogs({
        session_id: sessionId,
        query: 'error',
        limit: 10
      });
      
      expect(searchResult.isError).toBeFalsy();
      expect(searchResult.content[0].text).toContain('Database error');
      expect(searchResult.content[0].text).not.toContain('Server starting');
    });
    
    it('should filter logs by level', async () => {
      const sessionId = 'test-filter-level';
      
      const mockLogs = [
        { timestamp: new Date(), level: 'debug', message: 'Debug message' },
        { timestamp: new Date(), level: 'info', message: 'Info message' },
        { timestamp: new Date(), level: 'warn', message: 'Warning message' },
        { timestamp: new Date(), level: 'error', message: 'Error message' }
      ];
      
      const mockActorSpace = {
        actors: {
          logManager: {
            receive: jest.fn().mockResolvedValue({
              success: true,
              logs: mockLogs
            })
          }
        }
      };
      
      sessionManager.monitors.set(sessionId, { logManager: {} });
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, mockActorSpace);
      
      // Query with level filter (should include warn and error only)
      const result = await simplifiedTools.queryLogs({
        session_id: sessionId,
        level: 'warn',
        limit: 10
      });
      
      expect(result.isError).toBeFalsy();
      const text = result.content[0].text;
      expect(text).toContain('Warning message');
      expect(text).toContain('Error message');
      expect(text).not.toContain('Debug message');
      expect(text).not.toContain('Info message');
    });
  });
});