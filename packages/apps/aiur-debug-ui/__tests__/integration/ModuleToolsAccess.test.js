/**
 * Test for module tools access issue - tools shown in module_tools but not accessible
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

describe('Module Tools Access Integration Test', () => {
  let mockInterface;
  let mockToolManager;
  
  beforeEach(() => {
    // Mock the API interface
    mockInterface = {
      executeTool: jest.fn((toolName, params) => {
        // Default responses for common tools
        if (toolName === 'module_load') {
          return Promise.resolve({
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                module: params.name,
                status: 'loaded'
              })
            }]
          });
        }
        if (toolName === 'google_search') {
          return Promise.resolve({
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                query: params.query,
                organic: [
                  {
                    title: 'Test Result',
                    link: 'https://example.com',
                    snippet: 'Test snippet'
                  }
                ]
              })
            }]
          });
        }
        return Promise.reject(new Error(`Tool not found: ${toolName}`));
      }),
      getTools: jest.fn(() => [
        {
          name: 'module_list',
          description: 'List available and loaded modules'
        },
        {
          name: 'module_load', 
          description: 'Load a module to make its tools available'
        },
        {
          name: 'module_tools',
          description: 'List tools provided by a specific module'
        },
        {
          name: 'google_search',
          description: 'Search Google and get results using Serper API'
        }
      ])
    };

    // Mock ToolManager
    mockToolManager = {
      isToolsReady: jest.fn(() => true),
      getTools: jest.fn(() => {
        const toolsMap = new Map();
        toolsMap.set('module_list', {
          name: 'module_list',
          description: 'List available and loaded modules'
        });
        toolsMap.set('module_load', {
          name: 'module_load',
          description: 'Load a module to make its tools available'
        });
        toolsMap.set('module_tools', {
          name: 'module_tools',
          description: 'List tools provided by a specific module'
        });
        toolsMap.set('google_search', {
          name: 'google_search',
          description: 'Search Google and get results using Serper API'
        });
        return toolsMap;
      }),
      addEventListener: jest.fn(),
      refresh: jest.fn()
    };
  });

  test('should have google_search available after module_tools shows it', async () => {
    // Mock the module_tools response showing google_search
    mockInterface.executeTool.mockImplementation((toolName, params) => {
      if (toolName === 'module_tools' && params.name === 'serper') {
        return Promise.resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              module: 'serper',
              status: 'loaded',
              toolCount: 1,
              tools: [{
                name: 'google_search',
                description: 'Search Google and get results using Serper API'
              }]
            })
          }]
        });
      }
      if (toolName === 'google_search') {
        return Promise.resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              results: ['test result']
            })
          }]
        });
      }
      return Promise.reject(new Error(`Tool not found: ${toolName}`));
    });

    // Import and create CLI terminal
    const { CliTerminalV2 } = await import('../../src/client/cli-terminal-v2/components/CliTerminalV2.js');
    
    // Create a mock container
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Create CLI terminal instance
    const cli = new CliTerminalV2(container, mockInterface, mockToolManager);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that google_search is in the commands registry
    expect(cli.commands).toHaveProperty('google_search');
    expect(cli.commands.google_search).toHaveProperty('description');
    expect(cli.commands.google_search.description).toBe('Search Google and get results using Serper API');

    // Cleanup
    document.body.removeChild(container);
  });

  test('should execute google_search successfully', async () => {
    // Mock successful execution
    mockInterface.executeTool.mockImplementation((toolName, params) => {
      if (toolName === 'google_search' && params.query === 'fred') {
        return Promise.resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              query: 'fred',
              organic: [
                {
                  title: 'Fred Test Result',
                  link: 'https://example.com/fred',
                  snippet: 'This is a test result for Fred'
                }
              ]
            })
          }]
        });
      }
      return Promise.reject(new Error(`Tool not found: ${toolName}`));
    });

    // Import and create CLI terminal
    const { CliTerminalV2 } = await import('../../src/client/cli-terminal-v2/components/CliTerminalV2.js');
    
    // Create a mock container
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Create CLI terminal instance
    const cli = new CliTerminalV2(container, mockInterface, mockToolManager);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to execute google_search
    const result = await cli.executeTool('google_search', { query: 'fred' });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.query).toBe('fred');
    expect(result.organic).toHaveLength(1);
    expect(result.organic[0].title).toBe('Fred Test Result');

    // Cleanup
    document.body.removeChild(container);
  });

  test('should refresh commands after module_load', async () => {
    // Mock module_load response
    mockInterface.executeTool.mockImplementation((toolName, params) => {
      if (toolName === 'module_load' && params.name === 'serper') {
        return Promise.resolve({
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              module: 'serper',
              status: 'loaded'
            })
          }]
        });
      }
      return Promise.reject(new Error(`Tool not found: ${toolName}`));
    });

    // Mock ToolManager refresh to add google_search after module load
    mockToolManager.refresh.mockImplementation(() => {
      // Simulate adding google_search after module load
      const toolsMap = new Map();
      toolsMap.set('module_list', {
        name: 'module_list',
        description: 'List available and loaded modules'
      });
      toolsMap.set('module_load', {
        name: 'module_load',
        description: 'Load a module to make its tools available'
      });
      toolsMap.set('module_tools', {
        name: 'module_tools',
        description: 'List tools provided by a specific module'
      });
      toolsMap.set('google_search', {
        name: 'google_search',
        description: 'Search Google and get results using Serper API'
      });
      mockToolManager.getTools.mockReturnValue(toolsMap);
      return Promise.resolve();
    });

    // Import and create CLI terminal
    const { CliTerminalV2 } = await import('../../src/client/cli-terminal-v2/components/CliTerminalV2.js');
    
    // Create a mock container
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Create CLI terminal instance
    const cli = new CliTerminalV2(container, mockInterface, mockToolManager);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initially google_search might not be available
    // Execute module_load
    await cli.executeTool('module_load', { name: 'serper' });
    
    // After module_load, google_search should be available
    expect(mockToolManager.refresh).toHaveBeenCalled();
    
    // Wait for refresh to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that google_search is now in commands
    expect(cli.commands).toHaveProperty('google_search');

    // Cleanup
    document.body.removeChild(container);
  });
});