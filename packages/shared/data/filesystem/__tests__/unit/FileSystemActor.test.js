/**
 * Unit Tests for FileSystemActor
 * 
 * Tests the FileSystemActor class that handles filesystem operations
 * via Actor system messages.
 */

import { FileSystemActor } from '../../src/server/FileSystemActor.js';
import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileSystemActor', () => {
  let actor;
  let testDir;
  let mockActorSpace;
  
  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, '../tmp/filesystem-actor-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create mock actor space
    mockActorSpace = new Map();
    
    // Create actor
    actor = new FileSystemActor({
      rootPath: testDir,
      actorSpace: mockActorSpace,
      key: 'filesystem-actor',
      verbose: false
    });
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultActor = new FileSystemActor();
      
      expect(defaultActor.options.rootPath).toBe(process.cwd());
      expect(defaultActor.options.verbose).toBe(false);
    });
    
    test('should accept custom options', () => {
      const customActor = new FileSystemActor({
        rootPath: '/custom/path',
        verbose: true,
        maxFileSize: 50 * 1024 * 1024
      });
      
      expect(customActor.options.rootPath).toBe('/custom/path');
      expect(customActor.options.verbose).toBe(true);
      expect(customActor.options.maxFileSize).toBe(50 * 1024 * 1024);
    });
    
    test('should create LocalFileSystemResourceManager', () => {
      expect(actor.fsManager).toBeDefined();
      expect(actor.fsManager.rootPath).toBe(testDir);
    });
  });
  
  describe('Actor Interface', () => {
    test('should implement receive method', () => {
      expect(typeof actor.receive).toBe('function');
    });
    
    test('should return actor metadata', () => {
      const metadata = actor.getMetadata();
      
      expect(metadata).toEqual(expect.objectContaining({
        type: 'filesystem',
        capabilities: expect.objectContaining({
          read: true,
          write: true,
          watch: true,
          search: true,
          streams: true
        })
      }));
    });
  });
  
  describe('Connect Handler', () => {
    test('should handle connect message without auth', async () => {
      const message = {
        type: 'filesystemConnect',
        payload: {},
        requestId: 'req_123'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemConnected');
      expect(response.payload.success).toBe(true);
      expect(response.payload.sessionId).toBeDefined();
      expect(response.requestId).toBe('req_123');
    });
    
    test('should handle connect message with auth token', async () => {
      // Enable auth
      actor.options.enableAuth = true;
      actor.options.authTokens = new Set(['valid-token']);
      
      const message = {
        type: 'filesystemConnect',
        payload: { authToken: 'valid-token' },
        requestId: 'req_456'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemConnected');
      expect(response.payload.success).toBe(true);
      expect(response.payload.sessionId).toBeDefined();
    });
    
    test('should reject invalid auth token', async () => {
      actor.options.enableAuth = true;
      actor.options.authTokens = new Set(['valid-token']);
      
      const message = {
        type: 'filesystemConnect',
        payload: { authToken: 'invalid-token' },
        requestId: 'req_789'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Invalid authentication');
    });
  });
  
  describe('Query Handler', () => {
    beforeEach(async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello World');
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested content');
    });
    
    test('should handle file metadata query', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: {
            find: [],
            where: [['file', '/test.txt', 'metadata']]
          }
        },
        requestId: 'req_meta'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemQueryResult');
      expect(response.payload.success).toBe(true);
      expect(response.payload.results).toHaveLength(1);
      expect(response.payload.results[0]).toEqual(expect.objectContaining({
        path: '/test.txt',
        type: 'file',
        size: expect.any(Number)
      }));
    });
    
    test('should handle directory listing query', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: {
            find: [],
            where: [['parent', '/', 'list']]
          }
        },
        requestId: 'req_list'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemQueryResult');
      expect(response.payload.success).toBe(true);
      expect(response.payload.results.length).toBeGreaterThan(0);
      
      const fileNames = response.payload.results.map(item => item.name);
      expect(fileNames).toContain('test.txt');
      expect(fileNames).toContain('subdir');
    });
    
    test('should handle file content query', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: {
            find: [],
            where: [['file', '/test.txt', 'content']]
          }
        },
        requestId: 'req_content'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemQueryResult');
      expect(response.payload.success).toBe(true);
      expect(response.payload.results).toHaveLength(1);
      expect(response.payload.results[0]).toEqual(expect.objectContaining({
        path: '/test.txt',
        content: 'Hello World'
      }));
    });
    
    test('should handle empty query', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: { find: [], where: [] }
        },
        requestId: 'req_empty'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemQueryResult');
      expect(response.payload.success).toBe(true);
      expect(Array.isArray(response.payload.results)).toBe(true);
    });
    
    test('should handle invalid query', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: 'invalid'
        },
        requestId: 'req_invalid'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Invalid query');
    });
  });
  
  describe('Update Handler', () => {
    test('should handle file write operation', async () => {
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/new-file.txt',
          data: {
            content: 'New file content',
            operation: 'write'
          }
        },
        requestId: 'req_write'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemUpdateResult');
      expect(response.payload.success).toBe(true);
      expect(response.payload.path).toBe('/new-file.txt');
      
      // Verify file was created
      const content = await fs.readFile(path.join(testDir, 'new-file.txt'), 'utf8');
      expect(content).toBe('New file content');
    });
    
    test('should handle directory creation', async () => {
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/new-dir',
          data: {
            type: 'directory',
            operation: 'create'
          }
        },
        requestId: 'req_mkdir'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemUpdateResult');
      expect(response.payload.success).toBe(true);
      
      // Verify directory was created
      const stats = await fs.stat(path.join(testDir, 'new-dir'));
      expect(stats.isDirectory()).toBe(true);
    });
    
    test('should handle file deletion', async () => {
      // Create test file
      const testFile = path.join(testDir, 'to-delete.txt');
      await fs.writeFile(testFile, 'Delete me');
      
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/to-delete.txt',
          data: {
            operation: 'delete'
          }
        },
        requestId: 'req_delete'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemUpdateResult');
      expect(response.payload.success).toBe(true);
      
      // Verify file was deleted
      await expect(fs.access(testFile)).rejects.toThrow();
    });
    
    test('should handle binary file write', async () => {
      const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/binary.dat',
          data: {
            content: binaryData,
            operation: 'write'
          }
        },
        requestId: 'req_binary'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemUpdateResult');
      expect(response.payload.success).toBe(true);
      
      // Verify binary file was written correctly
      const readData = await fs.readFile(path.join(testDir, 'binary.dat'));
      expect(readData).toEqual(Buffer.from(binaryData));
    });
    
    test('should handle update errors gracefully', async () => {
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/nonexistent/deep/path/file.txt',
          data: {
            content: 'Content',
            operation: 'write'
          }
        },
        requestId: 'req_error'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toBeDefined();
    });
  });
  
  describe('Subscription Handler', () => {
    test('should handle subscription for file changes', async () => {
      const message = {
        type: 'filesystemSubscribe',
        payload: {
          querySpec: {
            find: [],
            where: [['file', '/test.txt', 'change']]
          },
          subscriptionId: 'sub_123'
        }
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemSubscribed');
      expect(response.payload.success).toBe(true);
      expect(response.payload.subscriptionId).toBe('sub_123');
      
      // Verify subscription was stored
      expect(actor.subscriptions.has('sub_123')).toBe(true);
    });
    
    test('should handle unsubscribe', async () => {
      // First subscribe
      const subscribeMessage = {
        type: 'filesystemSubscribe',
        payload: {
          querySpec: {
            find: [],
            where: [['file', '/test.txt', 'change']]
          },
          subscriptionId: 'sub_456'
        }
      };
      
      await actor.receive(subscribeMessage);
      expect(actor.subscriptions.has('sub_456')).toBe(true);
      
      // Now unsubscribe
      const unsubscribeMessage = {
        type: 'filesystemUnsubscribe',
        payload: {
          subscriptionId: 'sub_456'
        }
      };
      
      const response = await actor.receive(unsubscribeMessage);
      
      expect(response.type).toBe('filesystemUnsubscribed');
      expect(response.payload.success).toBe(true);
      expect(actor.subscriptions.has('sub_456')).toBe(false);
    });
    
    test('should handle subscription errors', async () => {
      const message = {
        type: 'filesystemSubscribe',
        payload: {
          querySpec: 'invalid',
          subscriptionId: 'sub_error'
        }
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    test('should handle unknown message types', async () => {
      const message = {
        type: 'unknownType',
        payload: {},
        requestId: 'req_unknown'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Unknown message type');
      expect(response.requestId).toBe('req_unknown');
    });
    
    test('should handle messages without requestId for non-subscription operations', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: { find: [], where: [] }
        }
        // No requestId
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Request ID is required');
    });
    
    test('should handle malformed messages', async () => {
      const message = {
        type: 'filesystemQuery'
        // No payload
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toBeDefined();
    });
  });
  
  describe('Path Validation', () => {
    test('should prevent path traversal in queries', async () => {
      const message = {
        type: 'filesystemQuery',
        payload: {
          querySpec: {
            find: [],
            where: [['file', '/../etc/passwd', 'content']]
          }
        },
        requestId: 'req_traversal'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Path traversal');
    });
    
    test('should prevent path traversal in updates', async () => {
      const message = {
        type: 'filesystemUpdate',
        payload: {
          path: '/../etc/passwd',
          data: {
            content: 'malicious',
            operation: 'write'
          }
        },
        requestId: 'req_traversal2'
      };
      
      const response = await actor.receive(message);
      
      expect(response.type).toBe('filesystemError');
      expect(response.payload.error.message).toContain('Path traversal');
    });
  });
  
  describe('Performance', () => {
    test('should handle concurrent messages', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        type: 'filesystemQuery',
        payload: {
          querySpec: { find: [], where: [] }
        },
        requestId: `req_${i}`
      }));
      
      const responses = await Promise.all(
        messages.map(msg => actor.receive(msg))
      );
      
      expect(responses).toHaveLength(10);
      responses.forEach((response, i) => {
        expect(response.requestId).toBe(`req_${i}`);
        expect(response.type).toBe('filesystemQueryResult');
      });
    });
  });
});