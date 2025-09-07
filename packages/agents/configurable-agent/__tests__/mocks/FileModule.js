/**
 * Mock FileModule for testing
 */

export default class FileModule {
  constructor() {
    this.name = 'file';
  }

  getTools() {
    return [
      {
        name: 'file_read',
        description: 'File read operation tool',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' }
          },
          required: ['path']
        },
        execute: async (params) => {
          return {
            success: true,
            content: 'Mock content'
          };
        }
      },
      {
        name: 'file_write',
        description: 'File write operation tool',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        },
        execute: async (params) => {
          // Check if trying to write to restricted path
          if (params.path && params.path.includes('/etc/')) {
            throw new Error('Permission denied');
          }
          return {
            success: true,
            message: 'File written successfully'
          };
        }
      },
      {
        name: 'directory_list',
        description: 'List files in directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list' }
          },
          required: ['path']
        },
        execute: async (params) => {
          return {
            success: true,
            files: ['file1.txt', 'file2.txt']
          };
        }
      },
      {
        name: 'file_delete',
        description: 'Delete a file from filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to delete' }
          },
          required: ['path']
        },
        execute: async (params) => {
          return {
            success: true,
            message: 'File deleted successfully'
          };
        }
      },
      {
        name: 'read',
        description: 'Alias for file_read operation',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' }
          },
          required: ['path']
        },
        execute: async (params) => {
          return {
            success: true,
            content: 'Mock content'
          };
        }
      },
      {
        name: 'write',
        description: 'Alias for file_write operation',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        },
        execute: async (params) => {
          if (params.path && params.path.includes('/etc/')) {
            throw new Error('Permission denied');
          }
          return {
            success: true,
            message: 'File written successfully'
          };
        }
      }
    ];
  }
}