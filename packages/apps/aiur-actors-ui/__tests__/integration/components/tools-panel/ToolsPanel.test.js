/**
 * Integration tests for ToolsPanel component
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('ToolsPanel Component Integration', () => {
  let ToolsPanel;
  let toolsPanel;
  let container;
  let actorSpace;
  let toolsActor;
  let commandActor;
  
  beforeEach(async () => {
    ({ ToolsPanel } = await import('../../../../src/components/tools-panel/index.js'));
    
    // Create DOM environment
    const env = TestUtilities.createDOMTestEnvironment();
    container = env.container;
    
    // Create mock actor space
    toolsActor = {
      receive: jest.fn()
    };
    commandActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'tools-actor': toolsActor,
      'command-actor': commandActor
    });
  });
  
  afterEach(() => {
    if (toolsPanel) {
      toolsPanel.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Complete Tools Workflow', () => {
    test('should load and display tools', async () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Verify tools request was sent
      expect(toolsActor.receive).toHaveBeenCalledWith({
        type: 'getTools'
      });
      
      // Simulate tools response
      const tools = [
        { id: 'file_read', name: 'Read File', description: 'Read file contents' },
        { id: 'file_write', name: 'Write File', description: 'Write to file' },
        { id: 'http_get', name: 'HTTP GET', description: 'Make HTTP request' }
      ];
      
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools
      });
      
      // Check tools are displayed
      const toolItems = container.querySelectorAll('.tool-item');
      expect(toolItems.length).toBe(3);
      expect(toolItems[0].textContent).toContain('Read File');
      expect(toolItems[1].textContent).toContain('Write File');
      expect(toolItems[2].textContent).toContain('HTTP GET');
    });

    test('should select and execute tool', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [{ id: 'test_tool', name: 'Test Tool' }]
      });
      
      // Click on tool
      const toolItem = container.querySelector('.tool-item');
      toolItem.click();
      
      // Verify tool is selected
      expect(toolItem.classList.contains('selected')).toBe(true);
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'toolSelected',
        toolId: 'test_tool',
        tool: { id: 'test_tool', name: 'Test Tool' }
      });
      
      // Double-click to execute
      toolItem.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      
      // Verify execution request
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'executeTool',
        toolId: 'test_tool'
      });
    });

    test('should search and filter tools', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      const tools = [
        { id: 'file_read', name: 'Read File' },
        { id: 'file_write', name: 'Write File' },
        { id: 'http_get', name: 'HTTP GET' }
      ];
      
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools
      });
      
      // Search for "file"
      const searchInput = container.querySelector('.tools-search input');
      searchInput.value = 'file';
      searchInput.dispatchEvent(new Event('input'));
      
      // Check filtered results
      const visibleTools = container.querySelectorAll('.tool-item:not(.hidden)');
      expect(visibleTools.length).toBe(2);
      
      // Check search results count
      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount.textContent).toContain('2 of 3');
    });

    test('should handle keyboard navigation', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [
          { id: 'tool1', name: 'Tool 1' },
          { id: 'tool2', name: 'Tool 2' },
          { id: 'tool3', name: 'Tool 3' }
        ]
      });
      
      const toolsList = container.querySelector('.tools-list');
      
      // Navigate down
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      let highlightedTool = container.querySelector('.tool-item.highlighted');
      expect(highlightedTool).toBeDefined();
      expect(highlightedTool.textContent).toContain('Tool 1');
      
      // Navigate down again
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      highlightedTool = container.querySelector('.tool-item.highlighted');
      expect(highlightedTool.textContent).toContain('Tool 2');
      
      // Select with Enter
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'executeTool',
        toolId: 'tool2'
      });
    });

    test('should show execution state', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [{ id: 'test_tool', name: 'Test Tool' }]
      });
      
      // Execute tool
      toolsPanel.executeTool('test_tool');
      
      // Check executing state
      const toolItem = container.querySelector('[data-tool-id="test_tool"]');
      expect(toolItem.classList.contains('executing')).toBe(true);
      expect(toolItem.querySelector('.tool-spinner')).toBeDefined();
      
      // Simulate completion
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolExecutionComplete',
        toolId: 'test_tool',
        success: true
      });
      
      // Check state cleared
      expect(toolItem.classList.contains('executing')).toBe(false);
      expect(toolItem.querySelector('.tool-spinner')).toBeNull();
    });
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      ToolsPanel.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.actorSpace).toBeDefined();
    });

    test('should support validation mode', () => {
      let validationChecks = null;
      
      const umbilical = {
        validate: (checks) => {
          validationChecks = checks;
          return true;
        },
        dom: container,
        actorSpace: actorSpace
      };
      
      const result = ToolsPanel.create(umbilical);
      
      expect(result).toBe(true);
      expect(validationChecks).toBeDefined();
      expect(validationChecks.hasDomElement).toBe(true);
      expect(validationChecks.hasActorSpace).toBe(true);
    });

    test('should validate required properties', () => {
      // Missing dom
      expect(() => {
        ToolsPanel.create({ actorSpace });
      }).toThrow();
      
      // Missing actor space
      expect(() => {
        ToolsPanel.create({ dom: container });
      }).toThrow();
    });

    test('should handle lifecycle callbacks', () => {
      const onMount = jest.fn();
      const onDestroy = jest.fn();
      
      const umbilical = {
        dom: container,
        actorSpace,
        onMount,
        onDestroy
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      expect(onMount).toHaveBeenCalledWith(toolsPanel);
      
      toolsPanel.destroy();
      
      expect(onDestroy).toHaveBeenCalledWith(toolsPanel);
    });

    test('should expose public API', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      expect(toolsPanel).toBeDefined();
      expect(typeof toolsPanel.refreshTools).toBe('function');
      expect(typeof toolsPanel.selectTool).toBe('function');
      expect(typeof toolsPanel.executeTool).toBe('function');
      expect(typeof toolsPanel.searchTools).toBe('function');
      expect(typeof toolsPanel.getSelectedTool).toBe('function');
      expect(typeof toolsPanel.destroy).toBe('function');
    });

    test('should handle configuration options', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: {
          theme: 'dark',
          groupByCategory: true,
          showDescriptions: false
        }
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Check theme applied
      const panel = container.querySelector('.tools-panel');
      expect(panel.classList.contains('tools-panel-theme-dark')).toBe(true);
      
      // Check category grouping
      expect(toolsPanel.viewModel.groupByCategory).toBe(true);
      
      // Check descriptions hidden
      expect(toolsPanel.viewModel.showDescriptions).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should display error when tools fail to load', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Simulate error response
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListError',
        error: 'Network connection failed'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.tools-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load tools');
      
      // Check retry button
      const retryButton = errorMessage.querySelector('.retry-button');
      expect(retryButton).toBeDefined();
      
      // Click retry
      retryButton.click();
      
      // Verify new request sent
      expect(toolsActor.receive).toHaveBeenLastCalledWith({
        type: 'getTools'
      });
    });

    test('should handle tool execution errors', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [{ id: 'test_tool', name: 'Test Tool' }]
      });
      
      // Execute tool
      toolsPanel.executeTool('test_tool');
      
      // Simulate error
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolExecutionError',
        toolId: 'test_tool',
        error: 'Permission denied'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.tools-error');
      expect(errorMessage.textContent).toContain('Tool execution failed');
      
      // Check tool state reset
      const toolItem = container.querySelector('[data-tool-id="test_tool"]');
      expect(toolItem.classList.contains('executing')).toBe(false);
    });
  });

  describe('Tool Categories', () => {
    test('should display tools grouped by category', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: { groupByCategory: true }
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load categorized tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [
          { id: 'file_read', name: 'Read File', category: 'File Operations' },
          { id: 'file_write', name: 'Write File', category: 'File Operations' },
          { id: 'http_get', name: 'HTTP GET', category: 'Network' }
        ]
      });
      
      // Check categories displayed
      const categories = container.querySelectorAll('.tool-category');
      expect(categories.length).toBe(2);
      
      const fileCategory = categories[0];
      expect(fileCategory.querySelector('.category-header').textContent).toBe('File Operations');
      expect(fileCategory.querySelectorAll('.tool-item').length).toBe(2);
      
      const networkCategory = categories[1];
      expect(networkCategory.querySelector('.category-header').textContent).toBe('Network');
      expect(networkCategory.querySelectorAll('.tool-item').length).toBe(1);
    });

    test('should toggle category view', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools with categories
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [
          { id: 'tool1', name: 'Tool 1', category: 'Category A' },
          { id: 'tool2', name: 'Tool 2', category: 'Category B' }
        ]
      });
      
      // Initially flat list
      expect(container.querySelector('.tool-category')).toBeNull();
      expect(container.querySelectorAll('.tool-item').length).toBe(2);
      
      // Toggle to category view
      toolsPanel.toggleCategoryView();
      
      expect(container.querySelectorAll('.tool-category').length).toBe(2);
      
      // Toggle back
      toolsPanel.toggleCategoryView();
      
      expect(container.querySelector('.tool-category')).toBeNull();
    });
  });

  describe('Real-time Updates', () => {
    test('should update tool details in real-time', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [{ id: 'test_tool', name: 'Test Tool', lastUsed: null }]
      });
      
      // Update tool details
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolDetailsUpdate',
        toolId: 'test_tool',
        details: { lastUsed: '2024-01-01T10:00:00Z' }
      });
      
      // Check details updated in model
      const tool = toolsPanel.model.getToolById('test_tool');
      expect(tool.lastUsed).toBe('2024-01-01T10:00:00Z');
    });

    test('should add new tools dynamically', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      toolsPanel = ToolsPanel.create(umbilical);
      
      // Load initial tools
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: [{ id: 'tool1', name: 'Tool 1' }]
      });
      
      expect(container.querySelectorAll('.tool-item').length).toBe(1);
      
      // Add new tool
      toolsPanel.viewModel.handleActorUpdate({
        type: 'toolAdded',
        tool: { id: 'tool2', name: 'Tool 2' }
      });
      
      expect(container.querySelectorAll('.tool-item').length).toBe(2);
      expect(container.querySelectorAll('.tool-item')[1].textContent).toContain('Tool 2');
    });
  });
});