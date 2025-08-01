/**
 * View Mode Switching Tests - Tests for switching between tree and source views
 */
import { createTestContainer, cleanupTestContainer } from '../../test-helpers.js';

describe('View Mode Switching', () => {
  let container;
  let ViewModeManager;

  beforeEach(async () => {
    container = createTestContainer();
    
    // Import ViewModeManager
    const viewModeModule = await import('../../../view/ViewModeManager.js');
    ViewModeManager = viewModeModule.ViewModeManager;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('ViewModeManager Creation', () => {
    test('should create view mode manager with required dependencies', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      
      expect(viewManager).toBeDefined();
      expect(viewManager.dom).toBe(container);
      expect(viewManager.config).toEqual(expect.objectContaining(mockConfig));
    });

    test('should initialize with tree view as default', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      
      expect(viewManager.getCurrentMode()).toBe('tree');
      expect(viewManager.isTreeMode()).toBe(true);
      expect(viewManager.isSourceMode()).toBe(false);
    });

    test('should support initial source mode', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        initialMode: 'source'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      
      expect(viewManager.getCurrentMode()).toBe('source');
      expect(viewManager.isTreeMode()).toBe(false);
      expect(viewManager.isSourceMode()).toBe(true);
    });
  });

  describe('Tree-to-Source Mode Switch', () => {
    test('should switch from tree to source mode', async () => {
      const mockConfig = {
        content: '{"name": "John", "age": 30}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Start in tree mode
      expect(viewManager.getCurrentMode()).toBe('tree');
      expect(container.querySelector('.hierarchy-tree-view')).toBeTruthy();
      expect(container.querySelector('.source-editor')).toBeFalsy();
      
      // Switch to source mode
      await viewManager.switchToSource();
      
      expect(viewManager.getCurrentMode()).toBe('source');
      expect(container.querySelector('.hierarchy-tree-view')).toBeFalsy();
      expect(container.querySelector('.source-editor')).toBeTruthy();
    });

    test('should preserve content when switching tree to source', async () => {
      const mockContent = '{"user": {"name": "John", "age": 30}}';
      const mockConfig = {
        content: mockContent,
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Switch to source mode
      await viewManager.switchToSource();
      
      // Content should be preserved
      const sourceContent = viewManager.getSourceContent();
      expect(sourceContent).toBe(mockContent);
    });

    test('should preserve tree state when switching to source', async () => {
      const mockConfig = {
        content: '{"level1": {"level2": {"level3": "value"}}}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Expand nodes in tree view
      viewManager.expandNode('root');
      viewManager.expandNode('level1');
      
      const expandedNodes = viewManager.getExpandedNodes();
      
      // Switch to source mode
      await viewManager.switchToSource();
      
      // Expanded state should be preserved
      expect(viewManager.getExpandedNodes()).toEqual(expandedNodes);
    });

    test('should emit mode change event on tree-to-source switch', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      let modeChangeEventFired = false;
      let eventData = null;

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.on('modeChange', (data) => {
        modeChangeEventFired = true;
        eventData = data;
      });
      
      viewManager.render();
      
      await viewManager.switchToSource();
      
      expect(modeChangeEventFired).toBe(true);
      expect(eventData).toEqual({
        fromMode: 'tree',
        toMode: 'source',
        format: 'json'
      });
    });

    test('should handle switch during tree editing', async () => {
      const mockConfig = {
        content: '{"editable": "value"}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Start editing a node
      viewManager.startEditing('editable');
      expect(viewManager.isEditing()).toBe(true);
      
      // Switch to source mode should cancel editing
      await viewManager.switchToSource();
      
      expect(viewManager.getCurrentMode()).toBe('source');
      expect(viewManager.isEditing()).toBe(false);
    });
  });

  describe('Source-to-Tree Mode Switch', () => {
    test('should switch from source to tree mode', async () => {
      const mockConfig = {
        content: '{"name": "John", "age": 30}',
        format: 'json',
        initialMode: 'source'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Start in source mode
      expect(viewManager.getCurrentMode()).toBe('source');
      expect(container.querySelector('.source-editor')).toBeTruthy();
      expect(container.querySelector('.hierarchy-tree-view')).toBeFalsy();
      
      // Switch to tree mode
      await viewManager.switchToTree();
      
      expect(viewManager.getCurrentMode()).toBe('tree');
      expect(container.querySelector('.source-editor')).toBeFalsy();
      expect(container.querySelector('.hierarchy-tree-view')).toBeTruthy();
    });

    test('should parse source content when switching to tree', async () => {
      const initialContent = '{"original": true}';
      const modifiedContent = '{"modified": true, "added": "value"}';
      
      const mockConfig = {
        content: initialContent,
        format: 'json',
        initialMode: 'source'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Modify content in source mode
      viewManager.setSourceContent(modifiedContent);
      
      // Switch to tree mode
      await viewManager.switchToTree();
      
      // Tree should reflect the modified content
      const treeData = viewManager.getTreeData();
      expect(treeData.children).toHaveLength(2); // modified and added properties
    });

    test('should handle invalid content when switching to tree', async () => {
      const validContent = '{"valid": true}';
      const invalidContent = '{invalid: json}';
      
      const mockConfig = {
        content: validContent,
        format: 'json',
        initialMode: 'source'
      };

      let errorEventFired = false;
      let errorData = null;

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.on('parseError', (data) => {
        errorEventFired = true;
        errorData = data;
      });
      
      viewManager.render();
      
      // Set invalid content
      viewManager.setSourceContent(invalidContent);
      
      // Try to switch to tree mode
      await viewManager.switchToTree();
      
      // Should emit error and stay in source mode
      expect(errorEventFired).toBe(true);
      expect(errorData.content).toBe(invalidContent);
      expect(viewManager.getCurrentMode()).toBe('source');
    });

    test('should emit mode change event on source-to-tree switch', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        initialMode: 'source'
      };

      let modeChangeEventFired = false;
      let eventData = null;

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.on('modeChange', (data) => {
        modeChangeEventFired = true;
        eventData = data;
      });
      
      viewManager.render();
      
      await viewManager.switchToTree();
      
      expect(modeChangeEventFired).toBe(true);
      expect(eventData).toEqual({
        fromMode: 'source',
        toMode: 'tree',
        format: 'json'
      });
    });

    test('should restore tree expansion state when switching from source', async () => {
      const mockConfig = {
        content: '{"level1": {"level2": {"level3": "value"}}}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Expand nodes in tree view
      viewManager.expandNode('root');
      viewManager.expandNode('level1');
      const originalExpansion = viewManager.getExpandedNodes();
      
      // Switch to source mode and back
      await viewManager.switchToSource();
      await viewManager.switchToTree();
      
      // Expansion state should be restored
      expect(viewManager.getExpandedNodes()).toEqual(originalExpansion);
    });
  });

  describe('State Preservation', () => {
    test('should maintain selection across mode switches', async () => {
      const mockConfig = {
        content: '{"selected": "value", "other": "data"}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Select a node in tree mode
      viewManager.selectNode('selected');
      expect(viewManager.getSelectedNode()).toBe('selected');
      
      // Switch modes and back
      await viewManager.switchToSource();
      await viewManager.switchToTree();
      
      // Selection should be preserved
      expect(viewManager.getSelectedNode()).toBe('selected');
    });

    test('should preserve format when switching modes', async () => {
      const mockConfig = {
        content: '<root><test>value</test></root>',
        format: 'xml'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      expect(viewManager.getFormat()).toBe('xml');
      
      // Switch modes
      await viewManager.switchToSource();
      expect(viewManager.getFormat()).toBe('xml');
      
      await viewManager.switchToTree();
      expect(viewManager.getFormat()).toBe('xml');
    });

    test('should handle theme preservation across modes', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json',
        theme: 'dark'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Switch to source mode
      await viewManager.switchToSource();
      
      // Theme should be preserved
      expect(container.querySelector('.theme-dark')).toBeTruthy();
      
      // Switch back to tree mode
      await viewManager.switchToTree();
      
      // Theme should still be preserved
      expect(container.querySelector('.theme-dark')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle switch failure gracefully', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Mock a failure during switch by overriding render method
      const originalRender = viewManager.render;
      viewManager.render = () => {
        if (viewManager.currentMode === 'source') {
          throw new Error('Switch failed');
        }
        originalRender.call(viewManager);
      };
      
      // Attempt to switch - should handle error gracefully
      const result = await viewManager.switchToSource();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Switch failed');
      
      // Should remain in original mode
      expect(viewManager.getCurrentMode()).toBe('tree');
    });

    test('should validate content before mode switch', async () => {
      const mockConfig = {
        content: '{"valid": true}',
        format: 'json',
        initialMode: 'source'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Set invalid content
      viewManager.setSourceContent('{broken json}');
      
      // Try to switch to tree mode
      const result = await viewManager.switchToTree();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(viewManager.getCurrentMode()).toBe('source');
    });

    test('should cleanup resources on mode switch', async () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      const treeView = viewManager.getCurrentView();
      let destroyCalled = false;
      
      const originalDestroy = treeView.destroy;
      treeView.destroy = () => {
        destroyCalled = true;
        originalDestroy.call(treeView);
      };
      
      await viewManager.switchToSource();
      
      expect(destroyCalled).toBe(true);
    });
  });

  describe('ViewModeManager API', () => {
    test('should provide current mode information', () => {
      const mockConfig = {
        content: '{"test": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      
      expect(viewManager.getCurrentMode()).toBe('tree');
      expect(viewManager.isTreeMode()).toBe(true);
      expect(viewManager.isSourceMode()).toBe(false);
      expect(viewManager.getSupportedModes()).toEqual(['tree', 'source']);
    });

    test('should provide content access methods', async () => {
      const mockContent = '{"access": "test"}';
      const mockConfig = {
        content: mockContent,
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Tree mode content access
      expect(viewManager.getContent()).toBe(mockContent);
      
      // Switch to source mode
      await viewManager.switchToSource();
      
      // Source mode content access
      expect(viewManager.getSourceContent()).toBe(mockContent);
      expect(viewManager.getContent()).toBe(mockContent);
    });

    test('should support mode switching via toggle', async () => {
      const mockConfig = {
        content: '{"toggle": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      expect(viewManager.getCurrentMode()).toBe('tree');
      
      // Toggle to source
      await viewManager.toggleMode();
      expect(viewManager.getCurrentMode()).toBe('source');
      
      // Toggle back to tree
      await viewManager.toggleMode();
      expect(viewManager.getCurrentMode()).toBe('tree');
    });

    test('should handle destroy cleanly', () => {
      const mockConfig = {
        content: '{"destroy": true}',
        format: 'json'
      };

      const viewManager = new ViewModeManager(container, mockConfig);
      viewManager.render();
      
      // Should destroy without errors
      expect(() => {
        viewManager.destroy();
      }).not.toThrow();
      
      // Should handle multiple destroy calls
      expect(() => {
        viewManager.destroy();
        viewManager.destroy();
      }).not.toThrow();
    });
  });
});