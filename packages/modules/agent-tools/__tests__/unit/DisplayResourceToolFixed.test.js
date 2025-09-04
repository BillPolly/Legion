/**
 * Unit tests for DisplayResourceTool - Fixed version that uses resourceActor directly
 * Tests the exact same pattern as /show command
 */

import { DisplayResourceTool } from '../../src/tools/DisplayResourceTool.js';

describe('DisplayResourceTool - Fixed Implementation', () => {
  let tool;
  let mockResourceActor;
  let capturedResourceRequests;

  beforeEach(() => {
    tool = new DisplayResourceTool();
    capturedResourceRequests = [];
    
    // Mock resourceActor that captures resource:request calls (same as /show uses)
    mockResourceActor = {
      receive: async (messageType, data) => {
        mockResourceActor.receive.calls = mockResourceActor.receive.calls || [];
        mockResourceActor.receive.calls.push({ messageType, data });
        
        if (messageType === 'resource:request') {
          capturedResourceRequests.push(data);
        }
        return { success: true };
      }
    };
  });

  describe('Tool Configuration', () => {
    test('should have correct name and category', () => {
      expect(tool.name).toBe('display_resource');
      expect(tool.category).toBe('ui');
    });

    test('should require context and resourceHandle parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.required).toEqual(['context', 'resourceHandle']);
      expect(schema.properties.context).toBeDefined();
      expect(schema.properties.resourceHandle).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    test('should fail when context is missing', async () => {
      const resourceHandle = {
        path: '/test/file.txt',
        __isResourceHandle: true
      };

      const result = await tool.execute({ resourceHandle });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Context is required');
    });

    test('should fail when resourceActor is missing from context', async () => {
      const context = {}; // Missing resourceActor
      const resourceHandle = {
        path: '/test/file.txt',
        __isResourceHandle: true
      };

      const result = await tool.execute({ context, resourceHandle });
      expect(result.success).toBe(false);
      expect(result.error).toBe('resourceActor not available in context');
    });

    test('should fail when resourceHandle is missing', async () => {
      const context = { resourceActor: mockResourceActor };

      const result = await tool.execute({ context });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource handle is required');
    });

    test('should fail when resourceHandle is invalid', async () => {
      const context = { resourceActor: mockResourceActor };
      const invalidHandle = { path: '/test/file.txt' }; // Missing __isResourceHandle

      const result = await tool.execute({ context, resourceHandle: invalidHandle });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid resource handle - must have path and __isResourceHandle properties');
    });
  });

  describe('Resource Type Detection', () => {
    const context = { resourceActor: mockResourceActor };

    test('should detect file type correctly', async () => {
      const resourceHandle = {
        path: '/test/document.txt',
        __isResourceHandle: true
      };

      const result = await tool.execute({ context, resourceHandle });

      expect(result.success).toBe(true);
      expect(capturedResourceRequests).toHaveLength(1);
      expect(capturedResourceRequests[0]).toEqual({
        path: '/test/document.txt',
        type: 'file'
      });
    });

    test('should detect image type correctly', async () => {
      const imageTypes = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
      
      for (const ext of imageTypes) {
        capturedResourceRequests.length = 0; // Reset
        const resourceHandle = {
          path: `/test/image${ext}`,
          __isResourceHandle: true
        };

        const result = await tool.execute({ context, resourceHandle });
        expect(result.success).toBe(true);

        expect(capturedResourceRequests).toHaveLength(1);
        expect(capturedResourceRequests[0]).toEqual({
          path: `/test/image${ext}`,
          type: 'image'
        });
      }
    });

    test('should detect directory type correctly', async () => {
      const directoryPaths = ['/test/folder/', '/test/folder', '/'];
      
      for (const path of directoryPaths) {
        capturedResourceRequests.length = 0; // Reset
        const resourceHandle = {
          path: path,
          __isResourceHandle: true
        };

        const result = await tool.execute({ context, resourceHandle });
        expect(result.success).toBe(true);

        expect(capturedResourceRequests).toHaveLength(1);
        expect(capturedResourceRequests[0]).toEqual({
          path: path,
          type: 'directory'
        });
      }
    });
  });

  describe('ResourceActor Integration', () => {
    const context = { resourceActor: mockResourceActor };

    test('should call resourceActor.receive with resource:request (same as /show)', async () => {
      const resourceHandle = {
        path: '/test/example.js',
        __isResourceHandle: true
      };

      const result = await tool.execute({ context, resourceHandle });

      expect(result.success).toBe(true);
      // Verify resourceActor was called exactly like /show command
      const calls = mockResourceActor.receive.calls || [];
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        messageType: 'resource:request',
        data: {
          path: '/test/example.js',
          type: 'file'
        }
      });

      // Verify return values
      expect(result).toEqual({
        windowId: '/test/example.js',
        viewerType: 'file',
        resourcePath: '/test/example.js'
      });
    });

    test('should handle resourceActor errors gracefully', async () => {
      const errorResourceActor = {
        receive: async () => {
          throw new Error('Resource request failed');
        }
      };
      
      const context = { resourceActor: errorResourceActor };
      const resourceHandle = {
        path: '/test/error.txt',
        __isResourceHandle: true
      };

      const result = await tool.execute({ context, resourceHandle });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Resource request failed');
    });
  });

  describe('Return Values', () => {
    const context = { resourceActor: mockResourceActor };

    test('should return correct window information', async () => {
      const resourceHandle = {
        path: '/project/src/main.py',
        __isResourceHandle: true
      };

      const result = await tool.execute({ context, resourceHandle });

      expect(result).toEqual({
        windowId: '/project/src/main.py',
        viewerType: 'file',
        resourcePath: '/project/src/main.py'
      });
    });

    test('should handle options parameter', async () => {
      const resourceHandle = {
        path: '/test/image.png',
        __isResourceHandle: true
      };
      const options = { viewerType: 'custom' };

      const result = await tool.execute({ context, resourceHandle, options });

      expect(result.viewerType).toBe('image'); // Should use detected type
      expect(result.resourcePath).toBe('/test/image.png');
    });
  });

  describe('Comparison with /show Command Pattern', () => {
    test('should use identical resource:request pattern as SlashCommandAgent.handleShow', () => {
      // This test verifies our tool uses the EXACT same pattern as /show command
      
      const context = { resourceActor: mockResourceActor };
      const testCases = [
        { path: '/test.txt', expectedType: 'file' },
        { path: '/image.png', expectedType: 'image' },
        { path: '/folder/', expectedType: 'directory' },
      ];

      return Promise.all(testCases.map(async ({ path, expectedType }) => {
        capturedResourceRequests.length = 0;
        const resourceHandle = { path, __isResourceHandle: true };
        
        const result = await tool.execute({ context, resourceHandle });
        expect(result.success).toBe(true);
        
        // Verify exact same call pattern as /show command  
        const calls = mockResourceActor.receive.calls || [];
        const lastCall = calls[calls.length - 1];
        expect(lastCall).toEqual({
          messageType: 'resource:request',
          data: { path, type: expectedType }
        });
      }));
    });
  });
});